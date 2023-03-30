import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as users from '../models/user.server.model';
import {categories} from "../models/userCategories";
import path from "path";
import fs from "mz/fs";
import logger from "../../config/logger";


const getImage = async (req: Request, res: Response): Promise<void> => {
    try{
        const id = req.params.id;
        const user = await users.checkField(id, categories.ID);
        if (user.length !== 1 || user[0].image_filename == null) {
            res.statusMessage = "Not Found. No user with specified ID, or user has no image";
            res.status(404).send();
            return;
        }
        logger.info(user[0].image_filename);
        const imagesFile = path.join(__dirname, '../../../storage/images');
        const userImage = path.join(imagesFile, user[0].image_filename);
        res.contentType(userImage.replace(/^[^.]*\./, "image/"));
        res.statusMessage = "OK";
        logger.info(userImage);
        res.status(200).sendFile(userImage);
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}


const setImage = async (req: Request, res: Response): Promise<void> => {
    try{
        const recToken = req.header("X-Authorization");
        const imageType = req.header("Content-Type");
        const image = req.body;
        const id = req.params.id
        const type = users.checkFile(imageType);
        if (type === 'invalid') {
            res.statusMessage = "Bad Request. Invalid image supplied (possibly incorrect file type)";
            res.status(400).send();
            return;
        }
        const userFromToken = await users.checkField(recToken, categories.TOKEN);
        if (userFromToken.length !== 1) {
            res.statusMessage = `Unauthorized`;
            res.status(401).send();
            return;
        }
        const userFromId = await users.checkField(id, categories.ID);
        if (userFromId.length !== 1) {
            res.statusMessage = `Not found. No such user with ID given`;
            res.status(404).send();
            return;
        }
        if (userFromToken[0].id !== userFromId[0].id) {
            res.statusMessage = `Forbidden. Can not change another user's profile photo`;
            res.status(403).send();
            return;
        }
        const filename = `user_${userFromToken[0].id}${type}`;
        const imagesFile = path.join(__dirname, '../../../storage/images');
        const userImage = path.join(imagesFile, filename);
        await fs.writeFile(userImage, image);
        if (userFromToken[0].image_filename === null) {
            await users.updateUserField(filename, String(userFromToken[0].id), categories.IMAGE, categories.ID)
            res.statusMessage = `Created. New image created`;
            res.status(201).send();
            return;
        } else {
            await users.updateUserField(filename, String(userFromToken[0].id), categories.IMAGE, categories.ID)
            res.statusMessage = `OK. Image updated`;
            res.status(200).send();
            return;
        }
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}


const deleteImage = async (req: Request, res: Response): Promise<void> => {
    try{
        const recToken = req.header("X-Authorization");
        const id = req.params.id
        const userFromToken = await users.checkField(recToken, categories.TOKEN);
        if (userFromToken.length !== 1) {
            res.statusMessage = `Unauthorized`;
            res.status(401).send();
            return;
        }
        const userFromId = await users.checkField(id, categories.ID);
        if (userFromId.length !== 1 || userFromId[0].image_filename == null) {
            res.statusMessage = `Not found. No such user with ID given`;
            res.status(404).send();
            return;
        }
        if (userFromToken[0].id !== userFromId[0].id) {
            res.statusMessage = `Forbidden. Can not change another user's profile photo`;
            res.status(403).send();
            return;
        }
        const imagesFile = path.join(__dirname, '../../../storage/images');
        const userImage = path.join(imagesFile, userFromId[0].image_filename);
        await fs.unlink(userImage);
        res.statusMessage = `OK`;
        res.status(200).send();
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

export {getImage, setImage, deleteImage}