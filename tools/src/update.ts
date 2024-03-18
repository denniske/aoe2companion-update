import {
    FileWithPayload,
    Metadata,
    UPDATE_CREATED_AND_WAITING_FOR_FILES,
    UPDATE_PUBLISHED,
    UPDATE_WAS_ALREADY_PUBLISHED,
    UpdateResponse, VERSION_WAS_ALREADY_PUBLISHED
} from "../../common/types";
import {from, mergeMap, toArray} from "rxjs";
import {createHash, getBase64URLEncoding} from "../../common/helpers";
import path from "path";
import fs from 'fs/promises';
import crypto from "crypto";
import * as process from "process";
import {config} from "dotenv";

config();

const folder = 'updates/87.0.0/87.0.1';

// async function uploadFileWithPost(asset: FileWithPayload) {
//
//     const signedPayload = asset.signedPayload as any;
//
//     console.log(signedPayload);
//
//     console.log(signedPayload.url);
//     console.log(signedPayload.fields);
//
//     console.log('Uploading ' + asset.path, signedPayload.fields.key, '...');
//
//     const path = folder + '/' + asset.path;
//     const bufferContent = await fs.readFile(path);
//
//     let file = new Blob([bufferContent]);
//
//     const form = new FormData();
//     form.append('ACL', 'public-read');
//
//     Object.entries(signedPayload.fields).forEach(([field, value]) => {
//         form.append(field, value as any);
//     })
//
//     form.append('file', file, signedPayload.fields.key);
//     const response = await fetch(signedPayload.url, {
//         method: 'POST',
//         body: form,
//     });
//
//     if (response.status !== 204) {
//         console.log('Upload failed', response.status, response.statusText);
//         console.log(await response.text());
//         throw new Error('Upload failed');
//     }
//
//     return await response.text();
// }

async function uploadFile(asset: FileWithPayload) {

    const signedPayload = asset.signedPayload as any;

    // console.log(signedPayload);

    // get path of url string in node js
    const url = new URL(signedPayload);
    const key = url.pathname.replaceAll('/', '');

    console.log('Uploading ' + asset.path, key, '...');

    const path = folder + '/' + asset.path;
    const bufferContent = await fs.readFile(path);

    const response = await fetch(signedPayload, {
        method: 'PUT',
        body: bufferContent,
    });

    if (![200, 204].includes(response.status)) {
        console.log('Upload failed', response.status, response.statusText);
        console.log(await response.text());
        throw new Error('Upload failed');
    }

    return await response.text();
}

async function uploadFiles(updateResponse: UpdateResponse) {
    console.log('');

    await from(updateResponse.files).pipe(
        mergeMap((file: FileWithPayload) => from(uploadFile(file)), 5),
        toArray(),
    ).toPromise();

    console.log('');
}

async function postUpdate(files: any[]) {
    // const postResponse = await fetch('http://localhost:3000/api/update', {
    const postResponse = await fetch('https://update.aoe2companion.com/api/update', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            "Content-Type": "application/json",
            "api-key": process.env.API_KEY!,
        },
        body: JSON.stringify({
            config: JSON.parse(await fs.readFile(folder + '/expoConfig.json', 'utf8')),
            metadata: JSON.parse(await fs.readFile(folder + '/metadata.json', 'utf8')),
            files,
        }),
    });

    return await postResponse.json() as UpdateResponse;
}

async function main() {
    console.log('Preparing update...');

    const files = [];

    const metadata = JSON.parse(await fs.readFile(folder + '/metadata.json', 'utf8')) as Metadata;

    const filesToUpload = [
        ...metadata.fileMetadata.ios.assets,
        ...metadata.fileMetadata.android.assets,
        {path: metadata.fileMetadata.ios.bundle, ext: 'bundle'},
        {path: metadata.fileMetadata.android.bundle, ext: 'bundle'},
    ];

    for (const file of filesToUpload) {
        const asset2 = await fs.readFile(path.resolve(folder + '/' + file.path), null);
        const hash = getBase64URLEncoding(createHash(asset2, 'sha256', 'base64'));
        const key = createHash(asset2, 'md5', 'hex');

        files.push({
            ...file,
            hash,
            key,
        });
    }

    const updateId = crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex');

    console.log();
    console.log('Update Id:', updateId);
    console.log('Assets (iOS):', metadata.fileMetadata.ios.assets.length, '+ 1 launch asset');
    console.log('Assets (Android):', metadata.fileMetadata.android.assets.length, '+ 1 launch asset');

    console.log();
    console.log('Sending update...');
    const updateResponse = await postUpdate(files);

    console.log();

    if (updateResponse.error) {
        console.log('Update failed:', updateResponse.error);
        return;
    }

    console.log('Update status:', updateResponse.status);

    console.log();

    if (updateResponse.status === UPDATE_WAS_ALREADY_PUBLISHED) {
        console.log('An update with this content already exists.');
    } else if (updateResponse.status === VERSION_WAS_ALREADY_PUBLISHED) {
        console.log('An update with this version already exists.');
    } else if (updateResponse.status === UPDATE_PUBLISHED) {
        console.log('Update published.');

        // Todo: Fetch manifest for runtime version

    } else if (updateResponse.status === UPDATE_CREATED_AND_WAITING_FOR_FILES) {
        await uploadFiles(updateResponse);

        const finalizeUpdateResponse = await postUpdate(files);

        if (finalizeUpdateResponse.status === UPDATE_PUBLISHED) {
            console.log('Update published.');

            // Todo: Fetch manifest for runtime version

        } else if (finalizeUpdateResponse.status === UPDATE_CREATED_AND_WAITING_FOR_FILES) {
            console.log('Update failed. Not all files have been uploaded.');
            console.log(finalizeUpdateResponse.files);
        } else {
            console.log('Update unexpected status:', finalizeUpdateResponse.status);
        }
    }

    console.log();
}

main();
