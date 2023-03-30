import {getPool} from "../../config/db";
import fs from 'mz/fs';
import Logger from '../../config/logger';
import {Field, ResultSetHeader} from "mysql2";
import {categories} from "./userCategories";

const updateUserField = async (input:string, identifier:string, inputCategory:categories, identifierCategory:categories) => {
    Logger.info(`Updating user ${identifier} ${inputCategory} ${input} to the db`);
    const conn = await getPool().getConnection();
    const query = `UPDATE user SET ${inputCategory} = ? WHERE ${identifierCategory} = ?`;
    await conn.query( query, [ input, identifier ] );
    await conn.release();
}

const checkField = async (input:string, field:categories) : Promise<User[]> => {
    Logger.info(`Checking if users ${field} ${input} in the db`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM user WHERE ${field} = ?`;
    const [result] = await conn.query(query, [input]);
    await conn.release();
    return result;
}

const insert = async (firstName: string, lastName: string, email: string, password:string) : Promise<ResultSetHeader> => {
    Logger.info(`Adding user ${firstName} ${email} to the database`);
    const conn = await getPool().getConnection();
    const query = 'insert into user (email, first_name, last_name, password) values ( ?,?,?,? )';
    const [ result ] = await conn.query( query, [ email, firstName, lastName, password ] );
    await conn.release();
    return result;
};

const checkFile = (file:string) => {
    const validFiles = ['image/png', 'image/jpeg', 'image/gif'];
    for (const f of validFiles) {
        if (f === file) {
            return `.`+file.substring(file.indexOf("/") + 1);
        }
    }
    return 'invalid';
}
export { insert, updateUserField, checkField, checkFile }