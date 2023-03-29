import Logger from "../../config/logger";
import {getPool} from "../../config/db";
import {categoriesFilmReview} from "./filmReviewCategories";
import logger from "../../config/logger";
import {ResultSetHeader} from "mysql2";

const deleteFilmReview = async (input:string)  => {
    Logger.info(`Deleting film ${input} from the database`);
    const conn = await getPool().getConnection();
    const query = 'delete from film_review where film_id = ?';
    await conn.query(query, [input]);
    await conn.release();
}

const checkField = async (input:string, field:categoriesFilmReview) : Promise<film_review[]>  => {
    Logger.info(`Checking if film review ${field} ${input} in the db`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM film_review WHERE ${field} = ?`;
    const [result] = await conn.query(query, [input]);
    await conn.release();
    return result;
}

const getFilmReview = async (input:string, field:categoriesFilmReview) : Promise<{id:number, film_id:number, user_id:number, rating:number, review:string, timestamp:string, first_name:string, last_name:string}[]>  => {
    Logger.info(`Checking if film review ${field} ${input} in the db`);
    const conn = await getPool().getConnection();
    const query = `
SELECT f.*, u.first_name AS first_name, u.last_name AS last_name
FROM film_review f JOIN user u ON f.user_id = u.id
WHERE ${field} = ?
ORDER BY timestamp DESC`;
    logger.info(query);
    const [result] = await conn.query(query, [input]);
    await conn.release();
    return result;
}

const insert = async (film:string, user:string, rating:string, review:string, timestamp:string) : Promise<ResultSetHeader> => {
    Logger.info(`Adding review to the database`);
    const conn = await getPool().getConnection();
    const query = 'insert into film_review (film_id, user_id, rating, review, timestamp) values ( ?,?,?,?,?)';
    const [ result ] = await conn.query( query, [ film, user, rating, review, timestamp ] );
    await conn.release();
    return result;
}

export { deleteFilmReview, checkField, getFilmReview, insert}