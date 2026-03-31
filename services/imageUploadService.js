// src/services/imageUploadService.js
const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class ImageUploadService {
  constructor() {
    this.supabase = supabase;
  }

  async uploadFromBase64(base64Data, bucketName, folderPath = '', imageName) {
    try {
      const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);

      let buffer, fileType;
      if (matches && matches.length === 3) {
        fileType = matches[1];
        buffer   = Buffer.from(matches[2], 'base64');
      } else {
        buffer   = Buffer.from(base64Data, 'base64');
        fileType = 'image/jpeg';
      }

      return this._upload(buffer, fileType, bucketName, folderPath, imageName);
    } catch (error) {
      throw new Error(`Failed to upload from base64: ${error.message}`);
    }
  }

  async _upload(buffer, fileType, bucketName, folderPath, imageName) {
    const ext      = this._ext(fileType);
    const name     = imageName
      ? `${imageName.replace(/\.[^.]+$/, '')}.${ext}`
      : `${uuidv4()}.${ext}`;
    const filePath = folderPath ? `${folderPath}/${name}` : name;

    const { error } = await this.supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType:  fileType,
        cacheControl: '3600',
        upsert:       false,
      });

    if (error) throw new Error(error.message);

    // Return path only — bucket is private, URLs generated via signed URL on demand
    return filePath;
  }

  // Generate a signed URL for private bucket access (default 1 hour)
  async getSignedUrl(bucketName, filePath, expiresIn = 3600) {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  _ext(mimeType) {
    const map = {
      'image/jpeg':      'jpg',
      'image/jpg':       'jpg',
      'image/png':       'png',
      'image/gif':       'gif',
      'image/webp':      'webp',
      'image/svg+xml':   'svg',
      'video/mp4':       'mp4',
      'video/webm':      'webm',
      'video/quicktime': 'mov',
    };
    return map[mimeType] || 'jpg';
  }
}

module.exports = new ImageUploadService();