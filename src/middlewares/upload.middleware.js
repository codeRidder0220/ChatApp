import multer from "multer";
import path from "node:path";

const storage  = multer.diskStorage({
    destination: "uploads/",  //file kaha save hogi

    filename: (req,file , cb)=>{
        const extension = path.extname(file.originalname);

        const fileName = `${Date.now()}-${Math.round(Math.random()*1e9)}${extension}`; //unique filename

        cb(null , fileName);
    }
});

export const upload = multer({
    storage,
    limits: {
        fileSize: 10*1024*1024  // maximum 10 MB
    }
});



