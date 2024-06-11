import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from 'jsonwebtoken'
import { User } from "../models/user.model.js";



export const verifyJWT = asyncHandler(async(req,res,next) => {

    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")

    if(!token){
        throw new ApiError(401,"Access Denied")
    }

    try {
        const decoded = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)

        console.log(decoded)

        const user = await User.findById(decoded?._id).select("-password -refreshToken")

        if(!user){
            throw new ApiError(401,"Invalid Access Token")
        }

        req.user = user
        next()
    } catch (error) {
        throw new ApiError(401,"Access Denied")
    }
})