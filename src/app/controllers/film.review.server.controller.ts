import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as review from "../models/filmReview.server.model";
import {categoriesFilmReview} from "../models/filmReviewCategories";
import * as films from "../models/film.server.model";
import {validate} from "../services/validation.services";
import * as schemas from "../resources/schemas.json";
import * as users from "../models/user.server.model";
import {categories} from "../models/userCategories";
import {isAfter} from "date-fns";


const getReviews = async (req: Request, res: Response): Promise<void> => {
    try{
        const id = req.params.id;
        const filmReview = await review.getFilmReview(id, categoriesFilmReview.FILM_ID);
        if (filmReview.length === 0) {
            res.statusMessage = `Not Found. No film with id`;
            res.status(404).send();
            return;
        }
        const body = [];
        for (const r of filmReview) {
            body.push( {"reviewerId": r.user_id, "rating": r.rating, "review": r.review, "reviewerFirstName":r.first_name, "reviewerLastName":r.last_name, "timestamp":r.timestamp});
        }
        res.statusMessage = "OK";
        res.status(200).send(body);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}


const addReview = async (req: Request, res: Response): Promise<void> => {
    try{
        const id = req.params.id;
        const validation = await validate(
            schemas.film_review_post,
            req.body);
        if (validation !== true) {
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
        const checkFilms = await films.getFilmById(id);
        if (checkFilms.length !== 1) {
            res.statusMessage = `Not Found. No film with id`;
            res.status(404).send();
            return;
        }
        const checkIfReviewed = await review.checkField(String(userFromToken[0].id), categoriesFilmReview.USER_ID);
        if ( isAfter(new Date(checkFilms[0].release_date), Date.now()) || checkFilms[0].director_id === userFromToken[0].id || checkIfReviewed.length !== 0) {
            res.statusMessage = `Forbidden. Cannot review your own film, or cannot post a review on a film that has not yet released`;
            res.status(404).send();
            return;
        }
        const add = review.insert(id, String(userFromToken[0].id), req.body.rating, req.body.review, new Date().toISOString().slice(0, 19).replace('T', ' '));
        res.statusMessage = `OK`;
        res.status(201).send();
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}



export {getReviews, addReview}