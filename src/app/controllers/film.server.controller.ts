import {Request, Response} from "express";
import Logger from "../../config/logger";
import {validate} from "../services/validation.services";
import * as schemas from "../resources/schemas.json";
import * as users from "../models/user.server.model";
import * as films from "../models/film.server.model";
import * as review from "../models/filmReview.server.model";
import {categoriesFilm} from "../models/filmCategories";
import {categories} from "../models/userCategories";
import {isAfter} from "date-fns";
import {categoriesFilmReview} from "../models/filmReviewCategories";
import {addOffSetQuery, getFilmsOnQuery, getGenre} from "../models/film.server.model";
import logger from "../../config/logger";


const viewAll = async (req: Request, res: Response): Promise<void> => {
    try{
        const validation = await validate(
            schemas.film_search,
            req.query);
        let genreIn = true;
        if (req.query.genreIds != null) {
            const genreList: string[] = String(req.query.genreIds).split(',');
            for (const i of genreList) {
                if (!await getGenre(String(i))) {
                    genreIn = false;
                }
            }
        }
        if (validation !== true || !genreIn) {
            res.statusMessage = `Bad Request`;
            res.status(400).send();
            return;
        }
        films.resetQuery();
        if (req.query.startIndex != null) {
            films.addOffSetQuery(String(req.query.startIndex));
        }
        if (req.query.count != null) {
            films.addLimitQuery(String(req.query.count));
        }
        if (req.query.sortBy != null) {
            films.addOrderByQuery(String(req.query.sortBy));
        }
        if (req.query.q != null) {
            films.addWhereQueryTitleDir(`'%${req.query.q}%'`);
        }
        if (req.query.directorId != null) {
            films.addWhereQuerySingle(String(req.query.directorId), categoriesFilm.DIRECTOR, );
        }
        if (req.query.reviewerId != null) {
            films.addWhereQueryForReview(String(req.query.reviewerId));
        }
        if (req.query.genreIds != null) {
            const genreList: string[] = String(req.query.genreIds).split(',');
            films.addWhereQueryMany(genreList, categoriesFilm.GENRE);
        }
        if (req.query.ageRatings != null) {
            const ageList: string[] = String(req.query.ageRatings).split(',');
            const newList: string[] = [];
            for (const i of ageList) {
                newList.push(`'${i}'`)
            }
            films.addWhereQueryMany(newList, categoriesFilm.AGE_RATING);
        }
        const body = [];
        const result = await getFilmsOnQuery();
        for (const r of result) {
            const rate :number = Number(Number(r.AveRating).toFixed(2).replace(/\.?0+$/, ''));
            body.push({"filmId": r.id, "title": r.title, "genreId": r.genre_id, "ageRating": r.age_rating, "directorId": r.director_id, "directorFirstName": r.first_name, "directorLastName": r.last_name, "rating": rate, "releaseDate": r.release_date} )
        }
        const num = await films.getCountFilms();
        logger.info(`Count = ${num[0].num_films}`);
        const message = {"films": body, "count":num[0].num_films};
        res.statusMessage = "OK";
        res.status(200).send(message);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const getOne = async (req: Request, res: Response): Promise<void> => {
    try{
        let result: string | any[] = [];
        if (req.params.id != null) {
            result = await films.getFilmById(req.params.id);
        }
        if (result.length === 0) {
            res.statusMessage = `Not Found. No film with id`;
            res.status(404).send();
            return;
        }
        const rate :number = Number(Number(result[0].AveRating).toFixed(2).replace(/\.?0+$/, ''));
        res.statusMessage = `OK`;
        logger.info(result[0].num_ratings)
        res.status(200).send({"filmId": result[0].id, "title": result[0].title, "genreId": result[0].genre_id, "ageRating":result[0].age_rating, "directorId": result[0].director_id, "directorFirstName": result[0].first_name, "directorLastName": result[0].last_name, "rating": rate, "releaseDate": result[0].release_date, "description":result[0].description, "runtime": result[0].runtime, "numReviews":result[0].num_ratings});
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const addOne = async (req: Request, res: Response): Promise<void> => {
    try{
        const validation = await validate(
            schemas.film_post,
            req.body);
        let reqDate = true;
        if (req.body.releaseDate != null) {
            reqDate = !isNaN(new Date(req.body.releaseDate).getTime());
        }
        if (validation !== true || !reqDate) {
            res.statusMessage = `Bad Request`;
            res.status(400).send();
            return;
        }
        const recToken = req.header("X-Authorization");
        const userFromToken = await users.checkField(recToken, categories.TOKEN);
        if (userFromToken.length !== 1) {
            res.statusMessage = `Unauthorized`;
            res.status( 401 ).send();
            return;
        }
        const checkFilmTitle = await films.checkField(req.body.title, categoriesFilm.TITLE);
        const time = !isAfter(Date.now(), new Date(req.body.releaseDate));
        if (checkFilmTitle.length !== 0 || !time) {
            res.statusMessage = `Forbidden. Film title is not unique, or cannot release a film in the past`;
            res.status( 403 ).send();
            return;
        }
        const createFilm = await films.insert(req.body.title, req.body.description, req.body.genreId, userFromToken[0].id);
        await films.updateFilmField(req.body.releaseDate ?? new Date().toISOString().slice(0, 19).replace('T', ' '), String(createFilm.insertId), categoriesFilm.RELEASE_DATE, categoriesFilm.ID);
        await films.updateFilmField(req.body.runtime ?? null, String(createFilm.insertId), categoriesFilm.RUNTIME, categoriesFilm.ID);
        await films.updateFilmField(req.body.ageRating ?? 'TBC', String(createFilm.insertId), categoriesFilm.AGE_RATING, categoriesFilm.ID);
        res.statusMessage = `Created`
        res.status( 201 ).send({"filmId": createFilm.insertId});
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const editOne = async (req: Request, res: Response): Promise<void> => {
    try{
        const id = req.params.id;
        const validation = await validate(
            schemas.film_patch,
            req.body);
        const validation2 = await validate(
            schemas.film_patch,
            req.params);
        let reqDate = true;
        if (req.body.releaseDate != null) {
            reqDate = !isNaN(new Date(req.body.releaseDate).getTime());
        }
        if (validation !== true || !reqDate || validation2 !== true) {
            res.statusMessage = `Bad Request`;
            res.status(400).send();
            return;
        }
        const recToken = req.header("X-Authorization");
        const userFromToken = await users.checkField(recToken, categories.TOKEN);
        if (userFromToken.length !== 1) {
            res.statusMessage = `Unauthorized`;
            res.status( 401 ).send();
            return;
        }
        const filmToEdit = await films.checkField(id, categoriesFilm.ID);
        if (filmToEdit.length !== 1) {
            res.statusMessage = `Not Found. No film found with id`;
            res.status( 404 ).send();
            return;
        }
        let dateInPass = false;
        if (req.body.releaseDate != null) {
            dateInPass = isAfter(Date.now(), new Date(filmToEdit[0].release_date));
        }
        const filmReview = await review.checkField(id, categoriesFilmReview.FILM_ID);
        // tslint:disable-next-line:no-unused-expression
        if (userFromToken[0].id !== filmToEdit[0].director_id || !isAfter(new Date(req.body.releaseDate), Date.now()), dateInPass || filmReview.length !== 0) {
            res.statusMessage = `Forbidden. Only the director of an film may change it, cannot change the releaseDate since it has already passed, cannot edit a film that has a review placed, or cannot release a film in the past`;
            res.status( 403 ).send();
            return;
        }
        await films.updateFilmField(req.body.title ?? filmToEdit[0].title, String(filmToEdit[0].id), categoriesFilm.TITLE, categoriesFilm.ID);
        await films.updateFilmField(req.body.description ?? filmToEdit[0].description, String(filmToEdit[0].id), categoriesFilm.DESCRIPTION, categoriesFilm.ID);
        await films.updateFilmField(req.body.releaseDate ?? filmToEdit[0].release_date, String(filmToEdit[0].id), categoriesFilm.RELEASE_DATE, categoriesFilm.ID);
        await films.updateFilmField(req.body.genreId ?? filmToEdit[0].genre_id, String(filmToEdit[0].id), categoriesFilm.GENRE, categoriesFilm.ID);
        await films.updateFilmField(req.body.runtime ?? filmToEdit[0].runtime, String(filmToEdit[0].id), categoriesFilm.RUNTIME, categoriesFilm.ID);
        await films.updateFilmField(req.body.ageRating ?? filmToEdit[0].age_rating, String(filmToEdit[0].id), categoriesFilm.AGE_RATING, categoriesFilm.ID);
        res.statusMessage = `OK`;
        res.status( 200 ).send();
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const deleteOne = async (req: Request, res: Response): Promise<void> => {
    try{
        const recToken = req.header("X-Authorization");
        const userFromToken = await users.checkField(recToken, categories.TOKEN);
        if (userFromToken.length !== 1) {
            res.statusMessage = `Unauthorized`;
            res.status( 401 ).send();
            return;
        }
        const filmToEdit = await films.checkField(req.params.id, categoriesFilm.ID);
        if (filmToEdit.length !== 1) {
            res.statusMessage = `Not Found. No film found with id`;
            res.status( 404 ).send();
            return;
        }
        if (userFromToken[0].id !== filmToEdit[0].director_id) {
            res.statusMessage = `Forbidden. Only the director of an film can delete it`;
            res.status( 403 ).send();
            return;
        }
        await films.deleteFilm(req.params.id);
        await review.deleteFilmReview(req.params.id);
        res.statusMessage = 'OK';
        res.status( 200 ).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const getGenres = async (req: Request, res: Response): Promise<void> => {
    try{
        const message = [];
        const filmGenre = await films.getAllFilmGenres();
        for (const film of filmGenre) {
            message.push({"genreId": film.id, "name": film.name} )
        }
        res.statusMessage = "OK";
        res.status(200).send(message);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

export {viewAll, getOne, addOne, editOne, deleteOne, getGenres};