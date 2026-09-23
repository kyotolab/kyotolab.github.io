import demo from "../shops/demo.json";

export const SHOPS = Object.fromEntries([demo].map((s) => [s.id, s]));
