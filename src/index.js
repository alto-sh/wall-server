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

const { URL, PORT } = process.env;

const urls = {};
const history = [];

const MIMES_BY_EXT = {
    'js': 'text/javascript',
    'css': 'text/css'
};

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
    let { url } = req.params;
    url = (url.startsWith('http://') || url.startsWith('https://')) ? url : `http://${url}`;
    const [ prot, other ] = url.split('://');
    let [ domain, ...path ] = other.split('/');
    if (domain.split('.').length == '2') {
        domain = 'www.' + domain;
    }
    url = `${prot}://${domain}` + `/${path.join('/')}`.replace(/\/\//g, '/');
    const base = url.match(/^https?:\/\/([a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+/)[0];
    fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
        },
        redirect: 'follow'
    }).then(r => {
        const mimeArray = r.headers.get('Content-Type').split(';');
        const mime = mimeArray.length > 0 ? mimeArray[0] : (MIMES_BY_EXT[url.split('.')[-1]] || 'text/plain');
        res.setHeader('Content-Type', mime);
        const dir = url.endsWith('/') ? url : `${prot}://${domain}/${path.slice(-1).join('/')}`;
        if (mime.startsWith('text')) {
            r.text().then(text => {
                const data = text
                    .replace(/(src|href|srcset)="(.*?)"/g, (_, attr, val) => {
                        const getPath = (val) => {
                            return /^https?:\/\//i.test(val) ? val : val.startsWith('/') ? dir + val.slice(1) : `${base}/${val}`;
                        };
                        if (attr == 'srcset') {
                            const parts = val.split(' ').map(getPath);
                            return (
                                `${attr}="${parts.join(' ')}"` 
                            );
                        } else {
                            if (val.startsWith('data:')) {
                                return (
                                    `${attr}="${val}"`
                                );
                            }
                            const path = getPath(val);
                            console.log(path);
                            return (
                                `${attr}="${URL}/fetch/${encodeURIComponent(path)}"`
                            );
                        }
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

http.listen(parseInt(PORT), () => {
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
