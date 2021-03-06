
const localStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
//const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


//Load the auth Variables
var configAuth = require('./auth');

// Local User Model
const User = require('../models/user');

module.exports = function(passport) {
    passport.use(
        new localStrategy({ usernameField: 'email'}, (email, password, done) =>{
            //Match User
            User.findOne({ email: email})
                .then(user => {
                    if(!user) {
                        return done(null, false, { message: 'That Email is not Registered'});
                    }
                    
                    //Match Password
                    bcrypt.compare(password, user.password, (err, isMatch) =>{
                        if(err)
                            throw err;
                        if(isMatch){                      
                            return done(null, user);
                        }
                        else{
                            return done(null, false, { message: 'Password is Incorrect'});
                        }
                    });
                })
                .catch(err => console.log(err));
        })
    );

    //Facebook 

    passport.use(new FacebookStrategy({

        // pull in our app id and secret from our auth.js file
        clientID        : configAuth.facebookAuth.clientID,
        clientSecret    : configAuth.facebookAuth.clientSecret,
        callbackURL     : configAuth.facebookAuth.callbackURL,
        profileFields       : configAuth.facebookAuth.profileFields,
        passReqToCallback : true // allows us to pass in the req from our route (lets us check if a user is logged in or not)

    },

    // facebook will send back the token and profile
    function(req, token, refreshToken, profile, done) {

        // asynchronous
        process.nextTick(function() {


            
            // check if the user is already logged in
            if (!req.user) {

                // find the user in the database based on their facebook id
                User.findOne({ 'facebook.id' : profile.id }, function(err, user) {

                    // if there is an error, stop everything and return that
                    // ie an error connecting to the database
                    if (err)
                        return done(err);
 
                        // if the user is found, then log them in
                    if (user) {

                        // if there is a user id already but no token (user was linked at one point and then removed)
                        // just add our token and profile information
                        if (!user.facebook.token) {
                            user.facebook.token = token;
                            user.facebook.name  = profile.name.givenName + ' ' + profile.name.familyName;
                            user.facebook.email = profile.emails[0].value;

                            user.save(function(err) {
                                if (err)
                                    throw err;
                                return done(null, user);
                            });
                        }

                        return done(null, user); // user found, return that user
                    } 
                    
                    else {
                        // if there is no user found with that facebook id, create them
                        var newUser            = new User({});

                        // set all of the facebook information in our user model
                        newUser.facebook.id    = profile.id; // set the users facebook id                   
                        newUser.facebook.token = token; // we will save the token that facebook provides to the user                    
                        newUser.facebook.name  = profile.name.givenName + ' ' + profile.name.familyName; // look at the passport user profile to see how names are returned
                        newUser.facebook.email = profile.emails[0].value; // facebook can return multiple emails so we'll take the first

                        // save our user to the database
                        newUser.save(function(err) {
                            if (err)
                                throw err;

                            // if successful, return the new user
                            return done(null, newUser);
                        });
                    }

                });
            
            } else {
                // user already exists and is logged in, we have to link accounts
                var user            = req.user; // pull the user out of the session

                // update the current users facebook credentials
                user.facebook.id    = profile.id;
                user.facebook.token = token;
                user.facebook.name  = profile.name.givenName + ' ' + profile.name.familyName;
                user.facebook.email = profile.emails[0].value;

                // save the user
                user.save(function(err) {
                    if (err)
                        throw err;
                    return done(null, user);
                });
            }

        });

    }));



    passport.serializeUser((user, done) => {
        done(null, user.id);
      });
      
      passport.deserializeUser((id, done) => {
        User.findById(id, (err, user) => {
          done(err, user);
        });
      });

}