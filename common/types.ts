
export const UPDATE_WAS_ALREADY_PUBLISHED = 'update-was-already-published';
export const VERSION_WAS_ALREADY_PUBLISHED = 'version-was-already-published';
export const UPDATE_PUBLISHED = 'update-published';
export const UPDATE_CREATED_AND_WAITING_FOR_FILES = 'update-created-and-waiting-for-files';

export interface IUpdate {
    update_id: string;
    runtime_version: string;
    version: string;
    created_at: Date | null;
    config: any;
}

export interface IAsset {
    update_id: string;
    file_id: string;
    platform: string;
    launch_asset: boolean;
}

export interface IUpdateWithAssets extends IUpdate {
    assets: IAsset[];
}

export interface IFile {
    file_id: string;
}

export interface UpdateResponse {
    error: string;
    status: string;
    files: FileWithPayload[]
}

export interface UpdateParams {
    config: any
    metadata: Metadata
    files: FileWithHashes[]
}

export interface Metadata {
    version: number
    bundler: string
    fileMetadata: FileMetadata
}

export interface FileMetadata {
    ios: Ios
    android: Ios
}

export interface Ios {
    bundle: string
    assets: Asset[]
}

export interface Asset {
    path: string
    ext: string
}

export interface FileWithPayload {
    path: string
    ext: string
    signedPayload: string
}

export interface FileWithHashes {
    path: string
    ext: string
    hash: string
    key: string
}