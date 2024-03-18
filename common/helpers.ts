import crypto, {BinaryToTextEncoding} from 'crypto';
import mime from 'mime';
import {Dictionary} from 'structured-headers';
import {Base64} from "./util";
import {IAsset} from "./types";

export class NoUpdateAvailableError extends Error {
}

export function createHash(file: Buffer, hashingAlgorithm: string, encoding: BinaryToTextEncoding) {
    return crypto.createHash(hashingAlgorithm).update(file).digest(encoding);
}

export function getBase64URLEncoding(base64EncodedString: string): string {
    return base64EncodedString.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function convertToDictionaryItemsRepresentation(obj: { [key: string]: string }): Dictionary {
    return new Map(
        Object.entries(obj).map(([k, v]) => {
            return [k, [v, new Map()]];
        })
    );
}

export function signRSASHA256(data: string, privateKey: string) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data, 'utf8');
    sign.end();
    return sign.sign(privateKey, 'base64');
}

export async function getPrivateKeyAsync() {
    return Base64.decode(process.env.EXPO_UPDATE_PRIVATE_KEY_BASE64 as string);
}

export async function getAssetMetadataAsync(asset: IAsset) {
    const [key, hash, ext] = asset.file_id.split('.');
    const contentType = asset.launch_asset ? 'application/javascript' : mime.getType(ext) ?? 'application/octet-stream';

    return {
        hash,
        key,
        fileExtension: `.${ext}`,
        contentType,
        url: `https://update.cdn.aoe2companion.com/${asset.file_id}`,
        // url: `https://aoe2companion-update.fra1.cdn.digitaloceanspaces.com/${asset.file_id}`,
        // url: `https://coder.aoe2companion.com/api/asset?file_id=${asset.file_id}`,
        // url: `https://update.aoe2companion.com/api/asset?file_id=${asset.file_id}`,
    };
}

export async function createNoUpdateAvailableDirectiveAsync() {
    return {
        type: 'noUpdateAvailable',
    };
}

export function convertSHA256HashToUUID(value: string) {
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(
        16,
        20
    )}-${value.slice(20, 32)}`;
}
