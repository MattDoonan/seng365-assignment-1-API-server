import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as users from '../models/user.server.model';
import * as schemas from '../resources/schemas.json';
import * as argon2 from 'argon2';
import * as token from 'rand-token';
import {validate} from "../services/validation.services";
import Ajv from 'ajv';
import {categories} from "../models/userCategories";
const ajv = new Ajv({removeAdditional: 'all', strict: false});


const register = async (req: Request, res: Response): Promise<void> => {
    try{
        // Your code goes here
        const validation = await validate(schemas.user_register, req.body)
        if (validation !== true) {
            res.statusMessage = `Bad Request. Invalid information`;
            res.status(400).send();
            return;
        }
        const firstName = req.body.firstName;
        const lastName = req.body.lastName;
        const email = req.body.email;
        const password = await argon2.hash(req.body.password);
        const emailReg = await users.checkField(email, categories.EMAIL);
        if (emailReg.length !== 0) {
            res.statusMessage = `Forbidden. Email already in use`;
            res.status(403).send();
            return;
        }
        const add = await users.insert(firstName, lastName, email, password);
        res.statusMessage = `OK`;
        res.status(201).send({ "userId": add.insertId });
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const login = async (req: Request, res: Response): Promise<void> => {
    try{
        const validation = await validate(
            schemas.user_login,
            req.body);
        if (validation !== true) {
            res.statusMessage = `Bad Request. Invalid information`;
            res.status(400).send();
            return;
        }
        const email = req.body.email;
        const emailCheck = await users.checkField(email, categories.EMAIL);
        if (emailCheck.length !== 1) {
            res.statusMessage = `Not Authorised. Incorrect email/password`;
            res.status( 401 ).send();
            return;
        }
        const passwordCheck = await argon2.verify(emailCheck[0].password, req.body.password );
        if (!passwordCheck) {
            res.statusMessage = `Not Authorised. Incorrect email/password`;
            res.status( 401 ).send();
            return;
        }
        const userToken = token.generate(32)
        await users.updateUserField(userToken, email, categories.TOKEN, categories.EMAIL);
        res.statusMessage = `OK`;
        res.status( 200 ).send({"userId": emailCheck[0].id, "token": userToken});
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const logout = async (req: Request, res: Response): Promise<void> => {
    try{
        const recToken = req.header("X-Authorization");
        const validUser = await users.checkField(recToken, categories.TOKEN);
        if (validUser.length !== 1) {
            res.statusMessage = `Unauthorized. Cannot log out if you are not authenticated`;
            res.status( 401 ).send();
            return;
        }
        await users.updateUserField(null, validUser[0].email, categories.TOKEN, categories.EMAIL)
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

const view = async (req: Request, res: Response): Promise<void> => {
    try{
        const recToken = req.header("X-Authorization");
        const validUser = await users.checkField(recToken, categories.TOKEN);
        const id = req.params.id
        if (validUser.length !== 1 || String(validUser[0].id) !== id) {
            const userFromId = await users.checkField(id, categories.ID);
            if (userFromId.length !== 1) {
                res.statusMessage = `Not Found. No user with specified ID`;
                res.status( 404 ).send();
                return;
            }
            res.statusMessage = `OK`;
            res.status(200).send({"firstName": userFromId[0].first_name, "lastName": userFromId[0].last_name})
            return;
        }
        res.statusMessage = `OK`;
        res.status(200).send({"email": validUser[0].email, "firstName": validUser[0].first_name, "lastName": validUser[0].last_name})
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}
const update = async (req: Request, res: Response): Promise<void> => {
    try{
        const id = req.params.id
        const userFromId = await users.checkField(id, categories.ID);
        if (userFromId.length !== 1) {
            res.statusMessage = `Not Found`;
            res.status(404).send();
            return;
        }
        const validation = await validate(
            schemas.user_edit,
            req.body);
        if (validation !== true) {
            res.statusMessage = `Bad Request. Invalid information`;
            res.status(400).send();
            return;
        }
        const recToken = req.header("X-Authorization");
        const userFromToken = await users.checkField(recToken, categories.TOKEN);
        let passwordCheck;
        if (req.body.currentPassword == null) {
            passwordCheck = true;
        } else {
            passwordCheck = await argon2.verify(userFromToken[0].password, req.body.currentPassword);
        }
        if (!passwordCheck || recToken == null || userFromToken.length !== 1) {
            res.statusMessage = `Unauthorized or Invalid currentPassword`;
            res.status(401).send();
            return;
        }
        const userFromEmail = await users.checkField(req.body.email, categories.EMAIL);
        if(req.body.password === req.body.currentPassword || userFromEmail.length !== 0 || userFromId[0].id !== userFromToken[0].id) {
            res.statusMessage = `Forbidden. This is not your account, or the email is already in use, or identical current and new passwords`;
            res.status(403).send();
            return;
        }
        await users.updateUserField(req.body.email ?? userFromToken[0].email, recToken, categories.EMAIL, categories.TOKEN);
        await users.updateUserField(req.body.firstName ?? userFromToken[0].first_name, recToken, categories.FIRST_NAME, categories.TOKEN);
        await users.updateUserField(req.body.lastName ?? userFromToken[0].last_name, recToken, categories.LAST_NAME, categories.TOKEN);
        if (req.body.currentPassword != null) {
            const password = await argon2.hash(req.body.currentPassword);
            await users.updateUserField(password, recToken, categories.PASSWORD, categories.TOKEN);
        }
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


export {register, login, logout, view, update}