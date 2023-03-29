import {categoriesFilm} from "./filmCategories";
import Logger from "../../config/logger";
import {getPool} from "../../config/db";
import {ResultSetHeader} from "mysql2";
import logger from "../../config/logger";

let whereQuery: string;
let countQuery: string;
let startQuery: string;
let sortByQuery: string;


const resetQuery = () => {
    whereQuery = ``;
    countQuery = ``;
    startQuery = ``;
    sortByQuery = `ORDER BY f.release_date ASC`;
}

const addWhereQuerySingle = (input:string, field:categoriesFilm) => {
    if (whereQuery === ``) {
        whereQuery = `WHERE f.${field} = ${input} `;
        return;
    }
    whereQuery = whereQuery + `AND f.${field} = ${input} `;
}

const addWhereQueryTitleDir = (input:string) => {
    if (whereQuery === ``) {
        whereQuery = `WHERE (f.title LIKE ${input} OR f.description LIKE ${input}) `;
        return;
    }
    whereQuery = whereQuery + `AND (f.title LIKE ${input} OR f.description LIKE ${input}) `;
}
const addWhereQueryMany = (input:string[], field:categoriesFilm) => {
    let toAdd = `(f.${field} = ${input[0]} `;
    const last = `OR f.${field} = ${input.pop()})`;
    input.shift();
    for (const i of input) {
        toAdd = toAdd + `OR f.${field} = ${input} `
    }
    toAdd = toAdd + last;
    if (whereQuery === ``) {
        whereQuery = `WHERE ` + toAdd + ` `;
        return;
    }
    whereQuery = whereQuery + `AND ` + toAdd + ` `;
}

const addWhereQueryForReview = (input:string) => {
    if (whereQuery === ``) {
        whereQuery = `WHERE r.user_id = ${input} `;
        return;
    }
    whereQuery = whereQuery + `AND r.user_id = ${input} `;
}

const addLimitQuery = (input:string) => {
    countQuery = `LIMIT ${input}`;
}

const addOffSetQuery = (input:string) => {
    startQuery = `OFFSET ${input}`;
}

const addOrderByQuery= (input:string) => {
    switch (input) {
        case 'ALPHABETICAL_ASC':
            sortByQuery = `ORDER BY f.title ASC, f.id ASC`;
            break;
        case 'ALPHABETICAL_DESC':
            sortByQuery = `ORDER BY f.title DESC, f.id ASC`;
            break;
        case 'RELEASED_ASC':
            sortByQuery = `ORDER BY f.release_date ASC, f.id ASC`;
            break;
        case 'RELEASED_DESC':
            sortByQuery = `ORDER BY f.release_date DESC, f.id ASC`;
            break;
        case 'RATING_ASC':
            sortByQuery = `ORDER BY AveRating ASC, f.id ASC`;
            break;
        default:
            sortByQuery = `ORDER BY AveRating DESC, f.id ASC`;
            break;
    }
}

const getFilmsOnQuery = async () : Promise<{id:number,title:string,description:string,release_date:string,image_filename:string,runtime:string,director_id:number,genre_id:number,age_rating:string,first_name:string,last_name:string,AveRating:number}[]> => {
    Logger.info(`Getting all films based of query`);
    const conn = await getPool().getConnection();
    const query = `SELECT f.*, d.first_name, d.last_name, (SELECT AVG(fr.rating) FROM film_review fr WHERE fr.film_id = f.id) AS AveRating
FROM film f
JOIN user d ON f.director_id = d.id
LEFT JOIN film_review r ON f.id = r.film_id` + `\n` + whereQuery + `\n` + `GROUP BY f.id, d.first_name, d.last_name` + `\n`+ sortByQuery + `\n` + countQuery + `\n` + startQuery;
    Logger.info(`\n${query}`);
    const [result] = await conn.query(query);
    await conn.release();
    return result;
}

const getCountFilms = async () :Promise<{num_films:number}[]> => {
    const conn = await getPool().getConnection();
    const query = `SELECT COUNT(*) as num_films FROM(SELECT f.*, d.first_name, d.last_name, (SELECT AVG(fr.rating) FROM film_review fr WHERE fr.film_id = f.id) AS AveRating
FROM film f
JOIN user d ON f.director_id = d.id
LEFT JOIN film_review r ON f.id = r.film_id` + `\n` + whereQuery + `\n` + `GROUP BY f.id, d.first_name, d.last_name` + `\n`+ sortByQuery + `\n) AS result`;
    const [result] = await conn.query(query);
    await conn.release();
    return result;
}

const getFilmById = async (id:string) :Promise<{id:number,title:string,description:string,release_date:string,image_filename:string,runtime:string,director_id:number,genre_id:number,age_rating:string,first_name:string,last_name:string,AveRating:number,num_ratings:number}[]> => {
    const conn = await getPool().getConnection();
    const query = `
    SELECT f.*, d.first_name, d.last_name, AVG(fr.rating) AS AveRating, COUNT(fr.rating) AS num_ratings
    FROM film f JOIN user d ON f.director_id = d.id LEFT JOIN film_review fr ON f.id = fr.film_id
    WHERE f.id = ?
    GROUP BY f.title, d.first_name, d.last_name`;
    logger.info(query);
    const [result] = await conn.query(query, [ id ]);
    await conn.release();
    logger.info(result)
    return result;
}

const checkField = async (input:string, field:categoriesFilm) : Promise<Film[]> => {
    Logger.info(`Checking if film ${field} ${input} in the db`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM film WHERE ${field} = ?`;
    const [result] = await conn.query(query, [input]);
    await conn.release();
    return result;
}

const insert = async (title: string, description: string, genreId: number, director: number) : Promise<ResultSetHeader> => {
    Logger.info(`Adding film ${title} by ${director} to the database`);
    const conn = await getPool().getConnection();
    const query = 'insert into film (title, description, genre_id, director_id, release_date, age_rating) values ( ?,?,?,?,?,?)';
    const [ result ] = await conn.query( query, [ title, description, genreId, director, new Date().toISOString().slice(0, 19).replace('T', ' '), 'TBC' ] );
    await conn.release();
    return result;
};

const deleteFilm = async (input:string)  => {
    Logger.info(`Deleting film ${input} from the database`);
    const conn = await getPool().getConnection();
    const query = 'delete from film where id = ?';
    await conn.query(query, [input]);
    await conn.release();
}

const updateFilmField = async (input:string, identifier:string, inputCategory:categoriesFilm, identifierCategory:categoriesFilm) => {
    Logger.info(`Updating film ${identifier} ${inputCategory} ${input} to the db`);
    const conn = await getPool().getConnection();
    const query = `UPDATE film SET ${inputCategory} = ? WHERE ${identifierCategory} = ?`;
    await conn.query( query, [ input, identifier ] );
    await conn.release();
}

const getAllFilmGenres = async (): Promise<{ id: number, name: string }[]> => {
    Logger.info(`Getting All films`);
    const conn = await getPool().getConnection();
    const query = `SELECT genre.id, genre.name FROM film JOIN genre ON film.genre_id = genre.id GROUP BY genre.name, genre.id ORDER BY genre.name ASC`;
    const [result] = await conn.query(query);
    await conn.release();
    return result;
}

const getGenre = async (genre:string): Promise<boolean> => {
    Logger.info(`Getting All films`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM genre WHERE id = ?`;
    const [result] = await conn.query(query, [ genre ]);
    await conn.release();
    return result.length > 0;
}

export { getFilmById, checkField, insert, updateFilmField, deleteFilm, getAllFilmGenres, resetQuery, addWhereQuerySingle, addWhereQueryMany, addWhereQueryTitleDir, addLimitQuery, addOffSetQuery, addOrderByQuery, getFilmsOnQuery, addWhereQueryForReview, getCountFilms, getGenre}