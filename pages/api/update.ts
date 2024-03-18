import {NextApiRequest, NextApiResponse} from 'next';
import {AWS_BUCKET, generateFileClient, generatePresignedPost, generatePresignedPut} from "../../common/file-helper";
import {
    Asset,
    IFile,
    IUpdate,
    UPDATE_CREATED_AND_WAITING_FOR_FILES,
    UPDATE_PUBLISHED,
    UPDATE_WAS_ALREADY_PUBLISHED,
    UpdateParams, VERSION_WAS_ALREADY_PUBLISHED
} from "../../common/types";
import crypto from "crypto";
import mime from "mime";
import prisma from "../../lib/prisma";
import {Prisma} from '@prisma/client'
import {upsertMany} from "../../lib/db";
import {uniqBy} from "lodash";
import {from, mergeMap, toArray} from "rxjs";
import {S3} from "@aws-sdk/client-s3";
import {convertSHA256HashToUUID} from "../../common/helpers";
import fs from "fs/promises";

function getMimeTypeFromExtension(ext: string) {

    // Hardcode .bundle as application/javascript
    if (ext === 'bundle') {
        return 'application/javascript';
    }

    const mimeType = mime.getType(ext);
    if (mimeType == null) {
        return 'application/octet-stream';
    }
    return mimeType;
}

async function fileInfo(client: S3, file: IFile) {
    try {
        const res = await fetch('https://update.cdn.aoe2companion.com/' + file.file_id, {
            method: 'HEAD',
        });

        // console.log(res.status);

        if (res.status === 404) {
            return {
                file,
                error: 'NotFound',
            };
        }

        if (res.status !== 200) {
            return {
                file,
                error: 'NotOK',
            };
        }

        // console.log(await res.text());
        // await client.headObject({
        //     Bucket: AWS_BUCKET,
        //     Key: file.file_id,
        // });
    } catch (error: any) {
        // if (error.name === 'NotFound') {
        //     return {
        //         file,
        //         error,
        //     };
        // }
        console.log('ERROR', error);
        throw error;
    }
    return {
        file,
        error: null,
    };
}

async function getMissingFiles(filesToUpload: IFile[]) {
    return prisma.file.findMany({
        where: {
            file_id: {
                in: filesToUpload.map(f => f.file_id),
            },
            verified: false,
        },
    });
}

async function getAllFiles(client: S3) {
    let continuationToken = undefined;

    const fileIds = [];
    let size = 0;

    while(true) {
        const result = await client.listObjectsV2({
            Bucket: AWS_BUCKET,
            // MaxKeys: 100,
            ContinuationToken: continuationToken,
        });
        fileIds.push(...result.Contents?.map(f => f.Key) || []);
        size += result.Contents?.reduce((acc, f) => acc + (f.Size || 0), 0) || 0;
        continuationToken = result.NextContinuationToken as string;
        if (!result.IsTruncated) break;
    }

    console.log(`${fileIds.length} files using ${(size / 1024 / 1024).toFixed(1)} MB`);

    return fileIds;
}

async function verifyFiles(client: S3, filesToUpload: IFile[]) {
    let missingFiles = await getMissingFiles(filesToUpload);

    console.log('Verifying files', missingFiles.length);
    const start = new Date();

    const existingFileIds = await getAllFiles(client);
    const existingFileIdMap = new Set(existingFileIds);

    const validFiles = missingFiles!.filter(f => existingFileIdMap.has(f.file_id));

    const res = await prisma.file.updateMany({
        where: {
            file_id: {
                in: validFiles.map(f => f.file_id),
            },
        },
        data: {
            verified: true,
        },
    });

    // const objs = await client.listObjects({
    //     Bucket: AWS_BUCKET,
    // });

    // const objs = await client.listObjectsV2({
    //     Bucket: AWS_BUCKET,
    //     MaxKeys: 300,
    //     ContinuationToken: '1-JTdCJTIydiUyMiUzQTElMkMlMjJzdGFydEFmdGVyJTIyJTNBJTIyYjY5ZTA4NDYwMjQwZjE2ODI5N2QwZjE4M2VhYTc3ODkuSWp1MFZJaV9UcjZRMDAzeEQxNU9FcjVOYzVScHJCYmp2cmhOT1NGLUdUUS5wbmclMjIlMkMlMjJ1dWlkJTIyJTNBJTIyN2U3MjhiMDEzYzkxOTU3NTc3YzFkNTYxMDhhNWIyZjQlMjIlN0Q=',
    // });
    //
    // console.log('objs', objs);
    // console.log('objs.length', objs.Contents?.length);

    // const fileInfos = await from(missingFiles).pipe(
    //     mergeMap((file) => from(fileInfo(client, file)), 50),
    //     toArray()
    // ).toPromise();

    console.log('Verifying files done in ' + (new Date().getTime() - start.getTime()) + 'ms');

    // const validFiles = fileInfos!.filter(f => f.error == null);
    //
    // const res = await prisma.file.updateMany({
    //     where: {
    //         file_id: {
    //             in: validFiles.map(f => f.file.file_id),
    //         },
    //     },
    //     data: {
    //         verified: true,
    //     },
    // });

    console.log('UPDATED FILES', res.count);

    missingFiles = await getMissingFiles(filesToUpload);

    return missingFiles.map(f => f.file_id);
}

export default async function updateEndpoint(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.json({error: 'Expected POST.'});
        return;
    }

    if (req.headers['api-key'] !== process.env.API_KEY) {
        res.statusCode = 403;
        res.json({error: 'Api Key missing or wrong:' + req.headers['api-key']});
        return;
    }

    const body: UpdateParams = req.body;

    const {config, metadata, files} = body;

    const updateId = convertSHA256HashToUUID(crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'));

    let updateWithSameVersion = await prisma.update.findFirst({
        where: {
            version: config.version,
            created_at: { not: null },
        }
    }) as IUpdate;

    if (updateWithSameVersion != null) {
        res.statusCode = 200;
        res.json({status: VERSION_WAS_ALREADY_PUBLISHED})
        res.end();
        return;
    }

    let update = await prisma.update.findUnique({
        where: {
            update_id: updateId,
        }
    }) as IUpdate;

    if (update == null) {
        update = await prisma.update.create({
            data: {
                update_id: updateId,
                runtime_version: config.runtimeVersion,
                version: config.version,
                config: config as Prisma.JsonObject,
                type: 'normal',
            }
        });
    }

    if (update.created_at != null) {
        res.statusCode = 200;
        res.json({status: UPDATE_WAS_ALREADY_PUBLISHED})
        res.end();
        return;
    }

    const client = generateFileClient();

    // const buckets = await client.listBuckets({});
    // console.log(buckets);
    //
    // await client.putObject({
    //     Bucket: 'aoe2companion-update',
    //     Key: 'test.jpg',
    //     Body: await fs.readFile('test.jpg'),
    // });

    // client.putObject({
    //     Bucket: 'aoe2companion-update',
    //     Key: '379cc98c3e58d37035d6cdf52951415b.j0Q_fM2_Fg1essaT5KCjRRaGx3SGBsFTEv1wx7v_xnY.lazy',
    //     ContentType: 'application/octet-stream',
    // }, (err, data) => {
    //     console.log(err, data);
    // })

    // client.copyObject({
    //
    //     Bucket: 'aoe2companion-update',
    //     Key: '379cc98c3e58d37035d6cdf52951415b.j0Q_fM2_Fg1essaT5KCjRRaGx3SGBsFTEv1wx7v_xnY.lazy',
    //     ContentType: 'application/octet-stream',
    // }, (err, data) => {
    //     console.log(err, data);
    // })

    // return;

    const getFileId = (asset: Asset) => {
        const fileWithHashes = files.find(f => f.path === asset.path && f.ext === asset.ext);

        if (fileWithHashes == null) {
            throw new Error(`File hash info not found for ${asset.path}`);
        }

        const {key, hash, ext} = fileWithHashes;
        return `${key}.${hash}.${ext}`;
    };

    let filesToUpload = [
        ...metadata.fileMetadata.ios.assets,
        ...metadata.fileMetadata.android.assets,
        {path: metadata.fileMetadata.ios.bundle, ext: 'bundle'},
        {path: metadata.fileMetadata.android.bundle, ext: 'bundle'},
    ].map(asset => ({
        ...asset,
        file_id: getFileId(asset),
    }));

    // const counter = filesToUpload.map(f => ({
    //     ...f,
    //     count: filesToUpload.filter(f2 => f2.file_id === f.file_id).length,
    // })).filter(f => f.count > 1);
    //
    // console.log('DUPLICATES', uniqBy(counter, f => f.file_id));
    // return;

    const fileItems: Partial<Prisma.fileCreateManyInput>[] = [];

    for (const asset of filesToUpload) {
        fileItems.push({
            file_id: getFileId(asset),
            presigned: new Date(),
        });
    }

    const assetItems: Prisma.assetCreateManyInput[] = [];

    for (const asset of metadata.fileMetadata.ios.assets) {
        assetItems.push({
            update_id: update.update_id,
            file_id: getFileId(asset),
            platform: 'ios',
            launch_asset: false,
        });
    }
    assetItems.push({
        update_id: update.update_id,
        file_id: getFileId({path: metadata.fileMetadata.ios.bundle, ext: 'bundle'}),
        platform: 'ios',
        launch_asset: true,
    });

    for (const asset of metadata.fileMetadata.android.assets) {
        assetItems.push({
            update_id: update.update_id,
            file_id: getFileId(asset),
            platform: 'android',
            launch_asset: false,
        });
    }
    assetItems.push({
        update_id: update.update_id,
        file_id: getFileId({path: metadata.fileMetadata.android.bundle, ext: 'bundle'}),
        platform: 'android',
        launch_asset: true,
    });

    const uniqueFileItems = uniqBy(fileItems, f => f.file_id);
    const uniqueAssetItems = uniqBy(assetItems, f => f.file_id + '-' + f.platform);

    await upsertMany(prisma, 'file', ['file_id'], uniqueFileItems);
    await upsertMany(prisma, 'asset', ['update_id', 'file_id', 'platform'], uniqueAssetItems);

    // Check S3 storage for files and update state in DB
    const missingFileIds = await verifyFiles(client, filesToUpload);

    filesToUpload = filesToUpload.filter(f => missingFileIds.some(file_id => file_id === f.file_id))

    filesToUpload = uniqBy(filesToUpload, f => f.file_id);

    if (filesToUpload.length > 0) {
        const filesToUploadReallyFormatted = [];
        for (const asset of filesToUpload) {
            filesToUploadReallyFormatted.push({
                path: asset.path,
                ext: asset.ext,
                signedPayload: await generatePresignedPut(client, getFileId(asset), getMimeTypeFromExtension(asset.ext)),
            });
        }

        res.statusCode = 200;
        res.json({
            status: UPDATE_CREATED_AND_WAITING_FOR_FILES,
            files: filesToUploadReallyFormatted,
        })
        res.end();

        return;
    }

    await prisma.update.update({
        where: {
            update_id: update.update_id,
        },
        data: {
            created_at: new Date(),
        }
    });

    res.statusCode = 200;
    res.json({status: UPDATE_PUBLISHED})
    res.end();
}
