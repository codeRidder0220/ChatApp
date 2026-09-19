import { readFile, unlink } from "node:fs/promises";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

import { s3 } from "../config/storage.js";
import { env } from "../config/env.js";


export const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "File is required"
            });
        }

        const fileBuffer = await readFile(req.file.path);

        const objectKey =
            `${Date.now()}-${req.file.filename}`;

        await s3.send(
            new PutObjectCommand({
                Bucket: env.S3_BUCKET,
                Key: objectKey,
                Body: fileBuffer,
                ContentType: req.file.mimetype
            })
        );

        await unlink(req.file.path);

        return res.status(201).json({
            success: true,
            file: {
                originalName: req.file.originalname,
                url: `/api/media/${encodeURIComponent(objectKey)}`,
                mimeType: req.file.mimetype,
                size: req.file.size
            }
        });

    } catch (error) {
        next(error);
    }
};


export const getFile = async (req, res, next) => {
    try {
        const objectKey = decodeURIComponent(req.params.key);

        const result = await s3.send(
            new GetObjectCommand({
                Bucket: env.S3_BUCKET,
                Key: objectKey
            })
        );

        res.setHeader(
            "Content-Type",
            result.ContentType || "application/octet-stream"
        );

        result.Body.pipe(res);

    } catch (error) {
        next(error);
    }
};