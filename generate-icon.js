const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const size = 32;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext("2d");

// Background circle
ctx.fillStyle = "#0ea5e9";
ctx.beginPath();
ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
ctx.fill();

// Clipboard lines
ctx.fillStyle = "#ffffff";
ctx.fillRect(8, 10, 16, 2);
ctx.fillRect(8, 15, 16, 2);
ctx.fillRect(8, 20, 10, 2);

const out = fs.createWriteStream(path.join(__dirname, "assets", "tray-icon.png"));
canvas.createPNGStream().pipe(out);
out.on("finish", () => console.log("Icon saved!"));