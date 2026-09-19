import express from 'express'

import  {upload} from "../middlewares/upload.middleware.js"
import { authenticate } from '../middlewares/auth.middleware.js'
import { uploadFile } from '../controllers/media.controller.js'

const router = express.Router();

router.post("/" , authenticate , upload.single("file") , uploadFile);

export default router;