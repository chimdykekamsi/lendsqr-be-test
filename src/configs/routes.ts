import { Router } from "express";

const routes = Router();

routes.get("/test", (req, res) => {
    res.json({ message: "Test route is working!" });
});

export default routes;