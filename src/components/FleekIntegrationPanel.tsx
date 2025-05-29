"use client";

import React, { useState } from "react";
import { FleekSdk, ApplicationAccessTokenService } from "@fleek-platform/sdk";

interface UploadResult {
  cid: string;
  hash: string;
  size: number;
  publicUrl?: string;
}

export default function FleekIntegrationPanel() {
  const [clientId, setClientId] = useState<string>(
    process.env.NEXT_PUBLIC_FLEEK_CLIENT_ID || ""
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadResult(null);
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    if (!clientId) {
      setError("Fleek Client ID is required. Set NEXT_PUBLIC_FLEEK_CLIENT_ID env var or enter manually.");
      return;
    }
    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      const applicationService = new ApplicationAccessTokenService({ clientId });
      const fleekSdk = new FleekSdk({ accessTokenService: applicationService });

      const result: any = await fleekSdk
        .storage()
        .uploadFile({
          file,
          onUploadProgress: (pe: ProgressEvent) => {
            if (pe.lengthComputable) {
              const percentComplete = Math.round(
                (pe.loaded / pe.total) * 100
              );
              setUploadProgress(percentComplete);
            }
          },
        });

      // The result object shape may differ; adjust according to SDK docs
      setUploadResult({
        cid: result?.cid || "",
        hash: result?.hash || "",
        size: result?.size || 0,
        publicUrl: result?.publicUrl || result?.url || undefined,
      });
    } catch (err: any) {
      console.error("[Fleek Upload] Error:", err);
      setError(err?.message || "Upload failed. Check console for details.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full bg-muted border border-border rounded-lg p-6 shadow-md space-y-4">
      <h2 className="text-lg font-semibold">Fleek Storage Uploader</h2>
      <p className="text-sm text-muted-foreground">
        Upload files to decentralized storage powered by Fleek. Provide an
        application Client&nbsp;ID to authenticate uploads directly from the
        browser.
      </p>

      {!process.env.NEXT_PUBLIC_FLEEK_CLIENT_ID && (
        <div className="space-y-1">
          <label className="block text-xs font-medium" htmlFor="fleek-client-id">
            Fleek Client&nbsp;ID
          </label>
          <input
            id="fleek-client-id"
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full bg-background border border-border rounded-md p-2 text-sm"
            placeholder="Enter your Fleek application client ID"
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-medium" htmlFor="fleek-file">
          Select File
        </label>
        <input
          id="fleek-file"
          type="file"
          onChange={handleFileChange}
          className="w-full text-sm"
        />
      </div>

      {file && (
        <p className="text-xs text-muted-foreground truncate">
          Selected: {file.name} ({Math.round(file.size / 1024)} KB)
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-100 p-2 rounded">{error}</p>
      )}

      {uploadResult && (
        <div className="text-xs text-green-700 bg-green-100 p-2 rounded space-y-1">
          <p>
            <span className="font-medium">CID:</span> {uploadResult.cid}
          </p>
          {uploadResult.publicUrl && (
            <p>
              <span className="font-medium">URL:</span>{" "}
              <a
                href={uploadResult.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {uploadResult.publicUrl}
              </a>
            </p>
          )}
          <p>
            <span className="font-medium">Size:</span>{" "}
            {uploadResult.size.toLocaleString()} bytes
          </p>
        </div>
      )}

      {isUploading && (
        <div className="w-full bg-border rounded-full h-2 overflow-hidden">
          <div
            style={{ width: `${uploadProgress}%` }}
            className="bg-primary h-full transition-all duration-300"
          ></div>
        </div>
      )}

      <button
        type="button"
        disabled={isUploading}
        onClick={handleUpload}
        className="w-full bg-primary text-white rounded-md py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {isUploading ? `Uploading (${uploadProgress}%)...` : "Upload to Fleek"}
      </button>
    </div>
  );
} 