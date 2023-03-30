import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as films from "../models/film.server.model";
import {categoriesFilm} from "../models/filmCategories";
import logger from "../../config/logger";
import path from "path";
import * as users from "../models/user.server.model";
import {categories} from "../models/userCategories";
import fs from "mz/fs";


const getImage = async (req: Request, res: Response): Promise<void> => {
    try{
        const id = req.params.id;
        const film = await films.checkField(id, categoriesFilm.ID);
        if (film.length !== 1 || film[0].image_filename == null) {
            res.statusMessage = "Not Found. No user with specified ID, or user has no image";
            res.status(404).send();
            return;
        }
        logger.info(film[0].image_filename);
        const imagesFile = path.join(__dirname, '../../../storage/images');
        const filmImage = path.join(imagesFile, film[0].image_filename);
        res.contentType(filmImage.replace(/^[^.]*\./, "image/"));
        res.statusMessage = "OK";
        logger.info(filmImage);
        res.status(200).sendFile(filmImage);
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
        const id = req.params.id;
        const type = users.checkFile(imageType);
        const userFromToken = await users.checkField(recToken, categories.TOKEN);
        if (userFromToken.length !== 1) {
            res.statusMessage = `Unauthorized`;
            res.status(401).send();
            return;
        }
        const filmFromId = await films.checkField(id, categoriesFilm.ID);
        if (filmFromId.length !== 1) {
            res.statusMessage = `Not Found. No film found with id`;
            res.status(404).send();
            return;
        }
        if (userFromToken[0].id !== filmFromId[0].director_id) {
            res.statusMessage = `Forbidden. Only the director of a film can change the hero image`;
            res.status(403).send();
            return;
        }
        if (type === 'invalid') {
            res.statusMessage = "Bad Request. Invalid image supplied (possibly incorrect file type)";
            res.status(400).send();
            return;
        }
        const filename = `user_${filmFromId[0].id}${type}`;
        const imagesFile = path.join(__dirname, '../../../storage/images');
        const filmImage = path.join(imagesFile, filename);
        await fs.writeFile(filmImage, image);
        if (filmFromId[0].image_filename === null) {
            await films.updateFilmField(filename, String(filmFromId[0].id), categoriesFilm.IMAGE_FILENAME, categoriesFilm.ID)
            res.statusMessage = `Created. New image created`;
            res.status(201).send();
            return;
        } else {
            await films.updateFilmField(filename, String(filmFromId[0].id), categoriesFilm.IMAGE_FILENAME, categoriesFilm.ID)
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

export {getImage, setImage};