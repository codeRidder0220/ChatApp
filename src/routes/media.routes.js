import express from 'express'

import  {upload} from "../middlewares/upload.middleware.js"
import { authenticate } from '../middlewares/auth.middleware.js'
import { getFile, uploadFile } from '../controllers/media.controller.js'

const router = express.Router();

router.post("/" , authenticate , upload.single("file") , uploadFile);
router.get("/:key", getFile)

export default router;