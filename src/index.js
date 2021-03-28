const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: '*'
    }
});

const URL = 'http://localhost:8080';

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

app.get('/fetch/:url', (req, res) => {
    let url = req.params.url.replace(/^\/\//, '');
    url = url.startsWith('http') ? url : 'http://' + url;
    const base = url.match(/^https?:\/\/([a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+/)[0];
    fetch(url).then(r => {
        const mime = r.headers.get('Content-Type').split(';')[0];
        res.setHeader('Content-Type', mime);
        if (mime.startsWith('text')) {
            r.text().then(text => {
                const data = text
                    .replace(/(src|href)="(.*?)"/g, (_, attr, val) => {
                        const path = val.match(/^(\/?[a-zA-Z0-9_%.-])+$/) ? base + '/' + val : val;
                        return (
                            `${attr}="${URL}/fetch/${encodeURIComponent(path)}"`
                        );
                    });
                res.send(data);
            });
        } else {
            r.blob().then(blob => {
                blob.arrayBuffer().then(buf => {
                    res.send(Buffer.from(buf));
                });
            });
        }
    });
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
