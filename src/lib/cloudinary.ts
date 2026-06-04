import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const UPLOAD_FOLDER = 'maya-products';

export interface SignedUploadParams {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  transformation: string;
}

export function validateImageUpload(fileType: string, fileSize: number): void {
  if (!ALLOWED_TYPES.has(fileType)) {
    throw new Error(`File type not allowed. Use JPEG, PNG, WebP, or AVIF.`);
  }
  if (fileSize > MAX_SIZE_BYTES) {
    throw new Error(`File too large. Maximum is 5 MB.`);
  }
}

export function generateSignedUploadParams(): SignedUploadParams {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.round(Date.now() / 1000);
  const transformation = 'c_limit,w_2048,q_auto,f_auto';

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: UPLOAD_FOLDER, transformation },
    apiSecret,
  );

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder: UPLOAD_FOLDER,
    transformation,
  };
}
