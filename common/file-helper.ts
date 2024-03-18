import {PutObjectCommand, S3} from "@aws-sdk/client-s3";
import {createPresignedPost} from "@aws-sdk/s3-presigned-post";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

export function generateFileClient() {
    return new S3([{}]);
}

export const AWS_BUCKET = 'aoe2companion-update';

export async function generatePresignedPut(client: S3, fileName: string, contentType: string) {
    const Bucket = AWS_BUCKET;
    const Key = fileName;

    const command = new PutObjectCommand({
        Bucket,
        Key,
    });

    return await getSignedUrl(client, command, {
        expiresIn: 3600
    });
}

export async function generatePresignedPost(client: S3, fileName: string, contentType: string) {
    const Bucket = AWS_BUCKET;
    const Key = fileName;

    const Fields = {
        'Content-Type': contentType,
        acl: "public-read",
    };

    return await createPresignedPost(client, {
        Bucket,
        Key,
        // Conditions: [["starts-with", "$key", "user/eric/"]],
        Fields,
        Expires: 600, // Seconds before the presigned post expires. 3600 by default.
    });
}
