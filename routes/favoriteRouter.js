const express = require('express');
const Favorite = require('../models/favorite');
const authenticate = require('../authenticate');
const cors = require('./cors');
const Campsite = require('../models/campsite');
const mongoose = require('mongoose');

const favoriteRouter = express.Router();

favoriteRouter.route('/')
    .options(cors.corsWithOptions, (req, res) => res.sendStatus(200))
    .get(cors.cors, authenticate.verifyUser, (req, res, next) => {
        Favorite.find()
            .populate('user')
            .populate('campsites')
            .then(favorites => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.json(favorites);
            })
            .catch(err => next(err));
    })
    .post(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
        const campsiteIds = req.body.map((fav) => fav._id);

        Favorite.findOneAndUpdate(
            { user: req.user._id },
            { $addToSet: { campsites: { $each: campsiteIds } } },
            { new: true, upsert: true } // upsert: true creates a new Favorite if it doesn't exist
        )
            .then((favorite) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.json(favorite);
            })
            .catch((err) => next(err));
    })
    .put(cors.corsWithOptions, authenticate.verifyUser, (req, res) => {
        res.statusCode = 403;
        res.end('PUT operation not supported on /favorites');
    })
    .delete(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
        Favorite.findOneAndDelete({ user: req.user._id })
            .then((response) => {
                res.statusCode = 200;
                if (response) {
                    res.setHeader('Content-Type', 'application/json');
                    res.json(response);
                } else {
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('You do not have any favorites to delete');
                }
            })
            .catch((err) => next(err));
    });

favoriteRouter.route('/:favoriteId')
    .options(cors.corsWithOptions, (req, res) => res.sendStatus(200))
    .get(cors.cors, (req, res, next) => {
        res.statusCode = 403;
        res.end('GET operation not supported on /favorites');
    })
    .post(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
        const campsiteId = req.params.campsiteId;

        if (!mongoose.Types.ObjectId.isValid(campsiteId)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Invalid campsite ID');
            return;
        }

        Campsite.findById(campsiteId)
            .then((campsite) => {
                if (!campsite) {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('Campsite not found');
                    return;
                }
                // Now we know the campsite exists, find or create the favorite
                return Favorite.findOne({ user: req.user._id });
            })
            .then((favorite) => {
                if (favorite && favorite.campsites.includes(campsiteId)) {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('Campsite is already in the list of favorites');
                    return;
                }
                return Favorite.findOneAndUpdate(
                    { user: req.user._id },
                    { $addToSet: { campsites: campsiteId } },
                    { new: true, upsert: true }
                );
            })
            .then((favorite) => {
                if (favorite) {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.json(favorite);
                }
            })
            .catch((err) => next(err));
    })
    .put(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
        res.statusCode = 403;
        res.end('PUT operation not supported on /favorites');
    })
    .delete(cors.corsWithOptions, authenticate.verifyUser, authenticate.verifyAdmin, (req, res, next) => {
        const campsiteId = req.params.campsiteId;
        Favorite.findOne({ user: req.user._id })
            .then((favorite) => {
                if (favorite) {
                    const newFilteredFavs = favorite.campsites.filter(campsite => {
                        campsite._id.equals(campsiteId)
                    })
                    favorite.campsites = newFilteredFavs;
                    favorite.save().then((response) => {
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.json(response);
                    })
                } else {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('You do not have any favorites to delete');
                }
            })
            .catch((err) => next(err));
    });

module.exports = favoriteRouter;