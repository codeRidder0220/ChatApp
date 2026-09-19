export const uploadFile = async(req,res,next)=>{
    try {
        if(!req.file){
            return res.status(400).json({
                success:false,
                message:"File is required"
            });
        }
        return res.status(201).json({
            success:true,
            file:{
                originalName: req.file.originalName,
                url: `/uploads/${req.file.filename}`,
                mimeType:  req.file.mimeType,
                size: req.file.size
            }
        });
    } catch (error) {
        next(error);
    }
}