const express = require('express');
const cors = require('cors');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: '*'
    }
});

const urls = {};
const history = [];

app.use(cors());
app.use(express.json());
app.options('*', cors());

app.get('/canvas/:url', (req, res) => {
    console.log(req.params.url);
    if (Object.keys(urls).includes(req.params.url)) {
        res.json({
            data: urls[req.params.url]
        });
    } else {
        res.json({
            data: ''
        });
    }
});

app.get('/history', (req, res) => {
    res.json({
        data: history
    });
});

app.post('/history/add', (req, res) => {
    const { url } = req.body;
    if (!history.includes(url)) {
        history.unshift(url);
    }
    while (history.length >= 10) {
        history.pop();
    }

    res.json({
        ok: true
    });
});

http.listen(8080, () => {
    console.log('Server up');
});

io.on('connection', (socket) => {
    socket.on('sync-dataurl', ({ url, data }) => {
        urls[url] = data;
    });

    socket.on('draw-line', ({ url, x1, y1, x2, y2, id, use }) => {
        io.emit('draw-line', { url, x1, y1, x2, y2, id, use });
    });
});
