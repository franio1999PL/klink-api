const auth = require('pocket-auth');
const express = require('express');
const cors = require('cors');
const GetPocket = require('node-getpocket');
const dotenv = require('dotenv');
const sgMail = require('@sendgrid/mail');
const { MongoClient } = require('mongodb');
const NodeCache = require('node-cache');
const cache = new NodeCache();

dotenv.config();

const PORT = process.env.PORT || 3000;

// Load instance of express app
const app = express();
app.use(cors());

// Konfiguracja SENDGRID
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Konfiguracja MongoDB
const url = process.env.DB_URL;
const dbName = 'pocket';

// Funkcja, która nawiązuje połączenie z bazą danych
async function connectToDatabase() {
    try {
        const client = new MongoClient(url);
        await client.connect();
        const db = client.db(dbName);
        return db;
    } catch (error) {
        console.error('Błąd podczas połączenia z bazą danych:', error);
    }
}

const checkApiKey = (req, res, next) => {
    const apiKey = req.headers['api-key'];

    if (apiKey === process.env.SECURITY_KEY) {
        next(); // Kontynuuj do obsługi właściwej trasy
    } else {
        res.status(401).send({ code: 401, message: 'Unauthorized' }); // Nieprawidłowy klucz API, zwróć odpowiedź Unauthorized
        return;
    }
};

app.get('/', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const kolekcjaWpisow = db.collection('wpisy');

        const config = {
            consumer_key: process.env.CONSUMER_KEY,
            access_token: process.env.ACCESS_KEY
        };

        const pocket = new GetPocket(config);

        const params = {
            favorite: 1,
            count: 1000,
            sort: 'newest',
            detailType: 'complete'
        };

        pocket.get(params, async (err, resp) => {
            if (err) {
                console.log(err);

                const emailNotification = {
                    to: 'sikorafranek@gmail.com',
                    from: 'no-reply@blady.dev',
                    subject: 'Problem z API knotz.link',
                    text: `
            Problem z autoryzacją access_key do api getpocket.com
            
            Pełny error msg: ${err}
          `,
                    html: `<strong>
          Problem z autoryzacją access_key do api getpocket.com
          
          Pełny error msg: ${err}</strong>
        `
                };

                sgMail
                    .send(emailNotification)
                    .then(response => {
                        console.log('Wysłano wiadomość informacyjną o problemie z API');
                    })
                    .catch(error => {
                        console.error(error);
                    });

                res.status(401).send({
                    error: '401',
                    message: 'Error with authorization (unknown access token)'
                });
                return;
            }

            const items = resp.list;
            const modifiedData = Object.values(items).map(
                ({
                    item_id: id,
                    given_url: url,
                    resolved_title: title,
                    excerpt: description,
                    time_favorited: time_added,
                    time_to_read: read_time,
                    word_count,
                    tags
                }) => ({
                    id,
                    url,
                    title,
                    description,
                    time_added,
                    read_time,
                    word_count,
                    tags: tags && Object.keys(tags).length > 0 ? tags : null
                })
            );

            // Sprawdzanie, czy wpis już istnieje w bazie danych
            const existingItems = await kolekcjaWpisow.find({ id: { $in: modifiedData.map(item => item.id) } }).toArray();
            const existingItemIds = existingItems.map(item => item.id);

            // Dodawanie nowych wpisów do bazy danych
            const newItems = modifiedData.map(item => {
                if (item.tags) {
                    item.tags = Object.values(item.tags);
                }
                return item;
            }).filter(item => !existingItemIds.includes(item.id));

            if (newItems.length > 0) {
                await kolekcjaWpisow.insertMany(newItems);
            }

            res.send({ code: 200, message: 'OK' });
        });
    } catch (error) {
        console.error('Błąd podczas obsługi żądania:', error);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/data', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const tag = req.query.tag;

        const cacheKey = `data:${page}:${tag}`;

        // Sprawdzenie, czy dane są dostępne w cache
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            // Dane są dostępne w cache, zwróć je bez odwoływania się do bazy danych
            res.send(cachedData);
        } else {
            // Dane nie są dostępne w cache, pobierz je z bazy danych
            const db = await connectToDatabase();
            const kolekcjaWpisow = db.collection('wpisy');
            const limit = 20;
            const skip = (page - 1) * limit;

            let query = {};

            if (tag) {
                query['tags.' + tag] = { $exists: true };
            }

            const totalCount = await kolekcjaWpisow.countDocuments(query);
            const totalPages = Math.ceil(totalCount / limit);

            const sortOptions = { time_added: -1 };

            const sortedData = await kolekcjaWpisow
                .find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .toArray();

            const data = {
                data: sortedData,
                totalPages: totalPages,
                currentPage: page
            };

            // Zapisz dane do cache
            cache.set(cacheKey, data, 3600); // Dane będą ważne przez 1 godzinę (3600 sekund)

            res.send(data);
        }
    } catch (error) {
        console.error('Błąd podczas obsługi żądania:', error);
        res.status(500).send('Błąd serwera');
    }
});






app.get('/tags', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const kolekcjaWpisow = db.collection('wpisy');

        const sortedData = await kolekcjaWpisow
            .find()
            .sort({ time_added: -1 })
            .toArray();

        const tagPool = new Set();
        sortedData.forEach(wp => {
            if (wp.tags) {
                const tags = Array.isArray(wp.tags) ? wp.tags : Object.values(wp.tags);
                tags.forEach(tag => {
                    tagPool.add(tag.tag);
                });
            }
        });

        res.send({
            tagPool: Array.from(tagPool)
        });
    } catch (error) {
        console.error('Błąd podczas obsługi żądania:', error);
        res.status(500).send('Błąd serwera');
    }
});

app.get('*', async (req, res) => {
    res.send({
        code: 404,
        message: 'NOT FOUND'
    });
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

module.exports = app;
