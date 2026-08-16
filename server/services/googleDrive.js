const { google } = require("googleapis");
const { Readable } = require("stream");

let driveClient = null;

function getDriveClient() {
  if (driveClient) return driveClient;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing OAuth2 credentials");
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "https://developers.google.com/oauthplayground");
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  driveClient = google.drive({ version: "v3", auth: oauth2Client });
  return driveClient;
}

function getExtension(mimeType) {
  switch (mimeType) {
    case "image/jpeg": case "image/jpg": return ".jpg";
    case "image/png": return ".png";
    case "image/webp": return ".webp";
    default: return "";
  }
}

async function uploadStaffPhoto(file) {
  if (!file) throw new Error("Photo file is required");
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_STAFF_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_STAFF_FOLDER_ID is not configured");

  const ext = getExtension(file.mimetype);
  const fileMetadata = {
    name: `staff_${Date.now()}${ext}`,
    parents: [folderId],
  };
  const media = {
    mimeType: file.mimetype,
    body: Readable.from(file.buffer),
  };
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id,name,mimeType,size",
    supportsAllDrives: true,
  });
  if (!response.data.id) throw new Error("Google Drive did not return a file ID");
  console.log("Staff photo uploaded:", response.data.id);
  return response.data.id;
}

async function getStaffPhoto(fileId) {
  if (!fileId) throw new Error("Photo file ID is required");
  const drive = getDriveClient();
  const response = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  return response;
}

async function getStaffPhotoMetadata(fileId) {
  if (!fileId) throw new Error("Photo file ID is required");
  const drive = getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size",
    supportsAllDrives: true,
  });
  return response.data;
}

async function deleteStaffPhoto(fileId) {
  if (!fileId) return;
  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
    console.log("Staff photo deleted from Google Drive:", fileId);
  } catch (error) {
    if (error.code === 404) {
      console.log(`Google Drive file ${fileId} already deleted`);
      return;
    }
    throw error;
  }
}

async function staffPhotoExists(fileId) {
  if (!fileId) return false;
  try {
    await getStaffPhotoMetadata(fileId);
    return true;
  } catch (error) {
    if (error.code === 404) return false;
    throw error;
  }
}

async function testStaffFolder() {
  const folderId = process.env.GOOGLE_DRIVE_STAFF_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_STAFF_FOLDER_ID is not configured");
  const drive = getDriveClient();
  const response = await drive.files.get({
    fileId: folderId,
    fields: "id,name,mimeType,parents,driveId",
    supportsAllDrives: true,
  });
  console.log("Google Drive Staff Folder:", response.data);
  return response.data;
}

module.exports = {
  uploadStaffPhoto,
  getStaffPhoto,
  getStaffPhotoMetadata,
  deleteStaffPhoto,
  staffPhotoExists,
  testStaffFolder,
};