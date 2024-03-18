import FormData from 'form-data';
import fs from 'fs/promises';
import {NextApiRequest, NextApiResponse} from 'next';
import {serializeDictionary} from 'structured-headers';

import {
    convertToDictionaryItemsRepresentation,
    createNoUpdateAvailableDirectiveAsync,
    getAssetMetadataAsync,
    getPrivateKeyAsync,
    NoUpdateAvailableError,
    signRSASHA256,
} from '../../common/helpers';
import prisma from "../../lib/prisma";
import {IUpdate, IUpdateWithAssets} from "../../common/types";

export default async function manifestEndpoint(req: NextApiRequest, res: NextApiResponse) {
    // res.setHeader('Vercel-CDN-Cache-Control', 'max-age=3600');
    // res.setHeader('CDN-Cache-Control', 'max-age=60');
    // res.setHeader('Cache-Control', 'max-age=10'); // Overwritten later

    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.json({error: 'Expected GET.'});
        return;
    }

    console.log();
    console.log('==> MANIFEST');
    console.log();
    console.log(req.headers);

    const protocolVersionMaybeArray = req.headers['expo-protocol-version'];
    if (protocolVersionMaybeArray && Array.isArray(protocolVersionMaybeArray)) {
        res.statusCode = 400;
        res.json({
            error: 'Unsupported protocol version. Expected either 0 or 1.',
        });
        return;
    }
    const protocolVersion = parseInt(protocolVersionMaybeArray ?? '0', 10);

    const platform = req.headers['expo-platform'] ?? req.query['platform'];
    if (platform !== 'ios' && platform !== 'android') {
        res.statusCode = 400;
        res.json({
            error: 'Unsupported platform. Expected either ios or android.',
        });
        return;
    }

    const runtimeVersion = req.headers['expo-runtime-version'] ?? req.query['runtime-version'];
    if (!runtimeVersion || typeof runtimeVersion !== 'string') {
        res.statusCode = 400;
        res.json({
            error: 'No runtimeVersion provided.',
        });
        return;
    }

    console.log('Looking for update with runtime version:', runtimeVersion);

    const update = await prisma.update.findFirst({
        include: {
            assets: true
        },
        where: {
            runtime_version: runtimeVersion,
            created_at: {not: null},
        },
        orderBy: {
            created_at: 'desc'
        },
    });
    if (!update) {
        res.statusCode = 404;
        res.json({
            error: 'Unsupported runtime version ' + runtimeVersion,
        });
        return;
    }

    console.log('Found update with id:', update.update_id);

    try {
        try {
            if (update.type === 'normal') {

                await putUpdateInResponseAsync(
                    req,
                    res,
                    update,
                    platform,
                    protocolVersion
                );

            } else if (update.type === 'rollBackToEmbedded') {

                await putRollBackInResponseAsync(req, res, update, protocolVersion);

            }

        } catch (maybeNoUpdateAvailableError) {
            if (maybeNoUpdateAvailableError instanceof NoUpdateAvailableError) {
                await putNoUpdateAvailableInResponseAsync(req, res, protocolVersion);
                return;
            }
            throw maybeNoUpdateAvailableError;
        }
    } catch (error) {
        console.error(error);
        res.statusCode = 404;
        res.json({error});
    }
}

enum UpdateType {
    NORMAL_UPDATE,
    ROLLBACK,
}

async function getTypeOfUpdateAsync(updateBundlePath: string): Promise<UpdateType> {
    const directoryContents = await fs.readdir(updateBundlePath);
    return directoryContents.includes('rollback') ? UpdateType.ROLLBACK : UpdateType.NORMAL_UPDATE;
}


async function putUpdateInResponseAsync(
    req: NextApiRequest,
    res: NextApiResponse,
    update: IUpdateWithAssets,
    platform: string,
    protocolVersion: number
): Promise<void> {
    const currentUpdateId = req.headers['expo-current-update-id'];

    // NoUpdateAvailable directive only supported on protocol version 1
    // for protocol version 0, serve most recent update as normal
    if (currentUpdateId === update.update_id && protocolVersion === 1) {
        throw new NoUpdateAvailableError();
    }

    const assets = update.assets.filter(a => a.platform === platform && !a.launch_asset);
    const launchAsset = update.assets.filter(a => a.platform === platform && a.launch_asset)[0];

    const manifest = {
        id: update.update_id,
        createdAt: update.created_at,
        runtimeVersion: update.runtime_version,
        assets: await Promise.all(assets.map((asset: any) => getAssetMetadataAsync(asset))),
        launchAsset: await getAssetMetadataAsync(launchAsset),
        metadata: {},
        extra: {
            expoClient: update.config,
        },
    };

    let signature = null;
    const expectSignatureHeader = req.headers['expo-expect-signature'];
    if (expectSignatureHeader) {
        const privateKey = await getPrivateKeyAsync();
        if (!privateKey) {
            res.statusCode = 400;
            res.json({
                error: 'Code signing requested but no key supplied when starting server.',
            });
            return;
        }
        const manifestString = JSON.stringify(manifest);
        const hashSignature = signRSASHA256(manifestString, privateKey);
        const dictionary = convertToDictionaryItemsRepresentation({
            sig: hashSignature,
            keyid: 'main',
        });
        signature = serializeDictionary(dictionary);
    }

    const assetRequestHeaders: { [key: string]: object } = {};
    [...manifest.assets, manifest.launchAsset].forEach((asset) => {
        assetRequestHeaders[asset.key] = {
            'test-header': 'test-header-value',
        };
    });

    const form = new FormData();
    form.append('manifest', JSON.stringify(manifest), {
        contentType: 'application/json',
        header: {
            // 'content-type': 'application/json; charset=utf-8', // Todo: need this?
            ...(signature ? {'expo-signature': signature} : {}),
        },
    });
    form.append('extensions', JSON.stringify({assetRequestHeaders}), {
        contentType: 'application/json',
    });

    res.statusCode = 200;
    res.setHeader('expo-protocol-version', protocolVersion);
    res.setHeader('expo-sfv-version', 0);
    res.setHeader('cache-control', 'private, max-age=0');
    res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
    res.write(form.getBuffer());
    res.end();
}

async function putRollBackInResponseAsync(
    req: NextApiRequest,
    res: NextApiResponse,
    update: IUpdate,
    protocolVersion: number
): Promise<void> {
    if (protocolVersion === 0) {
        throw new Error('Rollbacks not supported on protocol version 0');
    }

    const embeddedUpdateId = req.headers['expo-embedded-update-id'];
    if (!embeddedUpdateId || typeof embeddedUpdateId !== 'string') {
        throw new Error('Invalid Expo-Embedded-Update-ID request header specified.');
    }

    const currentUpdateId = req.headers['expo-current-update-id'];
    if (currentUpdateId === embeddedUpdateId) {
        throw new NoUpdateAvailableError();
    }

    const directive = {
        type: 'rollBackToEmbedded',
        parameters: {
            commitTime: update.created_at!.toISOString(),
        },
    };

    let signature = null;
    const expectSignatureHeader = req.headers['expo-expect-signature'];
    if (expectSignatureHeader) {
        const privateKey = await getPrivateKeyAsync();
        if (!privateKey) {
            res.statusCode = 400;
            res.json({
                error: 'Code signing requested but no key supplied when starting server.',
            });
            return;
        }
        const directiveString = JSON.stringify(directive);
        const hashSignature = signRSASHA256(directiveString, privateKey);
        const dictionary = convertToDictionaryItemsRepresentation({
            sig: hashSignature,
            keyid: 'main',
        });
        signature = serializeDictionary(dictionary);
    }

    const form = new FormData();
    form.append('directive', JSON.stringify(directive), {
        contentType: 'application/json',
        header: {
            // 'content-type': 'application/json; charset=utf-8',
            ...(signature ? {'expo-signature': signature} : {}),
        },
    });

    res.statusCode = 200;
    res.setHeader('expo-protocol-version', 1);
    res.setHeader('expo-sfv-version', 0);
    res.setHeader('cache-control', 'private, max-age=0');
    res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
    res.write(form.getBuffer());
    res.end();
}

async function putNoUpdateAvailableInResponseAsync(
    req: NextApiRequest,
    res: NextApiResponse,
    protocolVersion: number
): Promise<void> {
    if (protocolVersion === 0) {
        throw new Error('NoUpdateAvailable directive not available in protocol version 0');
    }

    const directive = await createNoUpdateAvailableDirectiveAsync();

    let signature = null;
    const expectSignatureHeader = req.headers['expo-expect-signature'];
    if (expectSignatureHeader) {
        const privateKey = await getPrivateKeyAsync();
        if (!privateKey) {
            res.statusCode = 400;
            res.json({
                error: 'Code signing requested but no key supplied when starting server.',
            });
            return;
        }
        const directiveString = JSON.stringify(directive);
        const hashSignature = signRSASHA256(directiveString, privateKey);
        const dictionary = convertToDictionaryItemsRepresentation({
            sig: hashSignature,
            keyid: 'main',
        });
        signature = serializeDictionary(dictionary);
    }

    const form = new FormData();
    form.append('directive', JSON.stringify(directive), {
        contentType: 'application/json',
        header: {
            // 'content-type': 'application/json; charset=utf-8',
            ...(signature ? {'expo-signature': signature} : {}),
        },
    });

    res.statusCode = 200;
    res.setHeader('expo-protocol-version', 1);
    res.setHeader('expo-sfv-version', 0);
    res.setHeader('cache-control', 'private, max-age=0');
    res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
    res.write(form.getBuffer());
    res.end();
}
