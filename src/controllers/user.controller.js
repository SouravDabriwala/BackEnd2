import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from "../utils/ApiError.js"
import { ApiResponse } from '../utils/ApiResponse.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import jwt, { decode } from 'jsonwebtoken'


const generateAccessAndRefreshTokens = async (userId) => {
    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new ApiError(404, "User not found")
      }

      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()

      user.refreshToken = refreshToken
      await user.save({validateBeforeSave : false})

      return {accessToken,refreshToken}

        
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler ( async (req,res) => {
    console.log('first')
    const {fullName,username,email,password} = req.body

    if(
        [fullName,username,email,password].some((field)=> field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required")
    }


    const existingUser =    await  User.findOne({
                                                $or:[
                                                    {username},
                                                    {email}
                                                ]
                                                })


    if(existingUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path
    let coverImageLocalPath = ""
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0)
     coverImageLocalPath = req.files?.coverImage[0]?.path 

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }

    console.log('hi')

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    
     const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar is required")
    }

    const user = await User.create({
                        fullName,
                        username:username.toLowerCase(),
                        email,
                        password,
                        avatar:avatar.url,
                        coverImage:coverImage?.url || ""
                  })


    const createdUser= await User.findById(user._id).select("-password -refreshToken")

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered Successfully")
    )

})

const loginUser = asyncHandler(async (req,res) => {
    const {email,username,password} = req.body
    if (!(email || username) || !password) {
        throw new ApiError(400,"username or email is required with password")
    }

    const user = await User.findOne({
        $or:[{email},{username}]
    })

    if(!user){
        throw new ApiError(401,"Invalid Credentials")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if(!isPasswordCorrect){
        throw new ApiError(401,"Invalid Password")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }

    return res.status(200)
          .cookie("accessToken",accessToken,options)
          .cookie("refreshToken",refreshToken,options)
          .json(
               new ApiResponse(200,
                {
                    user:loggedInUser,refreshToken,accessToken
                },
                "User Logged In Successfully"
            )
          )

})


const logoutUser = asyncHandler(async(req,res)=>{
    console.log(req.user)
    const userId = req.user._id

    await User.findByIdAndUpdate(
        userId,
        {$set :{refreshToken:undefined} },
        {new:true}
    )

    const options = {
        httpOnly:true,
        secure:true
    }

    return res.status(200)
              .clearCookie("accessToken",options)
              .clearCookie("refreshToken",options)
              .json(
                new ApiResponse(200,
                    {},
                    "User Logged Out Successfully"
                )
              )




})

const refreshAccessToken = asyncHandler(async(req,res) => {
   
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request")
    }

    try {
      const decoded = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
      const user = await User.findById(decoded?._id)
      if(!user){
        throw new ApiError(401,"User not found")
      }

      if(incomingRefreshToken !== user.refreshToken){
        throw new ApiError(401,"Invalid token")
      }

      const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
      const options = {
        httpOnly:true,
        secure:true
      }

      return res.status(200)
               .cookie("accessToken",accessToken,options)
               .cookie("refreshToken",newRefreshToken,options)
               .json(
                    new ApiResponse(200,
                        {accessToken,refreshToken:newRefreshToken},
                        "Access Token Refreshed"
                    )
                )
        
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Token")
        
    }


   



})


export {registerUser,loginUser,logoutUser,refreshAccessToken}