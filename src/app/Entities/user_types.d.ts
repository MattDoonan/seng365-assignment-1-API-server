type User = {
    /**
     * User id as defined by the database
     */
    id: number,
    /**
     * Users firstname as entered when created
     */
    first_name: string

    /**
     * Users firstname as entered when created
     */
    last_name: string

    /**
     * Users email as entered when created
     */
    email: string

    /**
     * Users password hashed
     */
    password: string

    /**
     * authentication
     */
    auth_token: string
}