var express = require("express");
const app = express();

const socketio = require("socket.io");

var formidable = require("express-formidable");
app.use(formidable());

var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectId;

var http = require("http").createServer(app);
var bcrypt = require("bcrypt");
var fileSystem = require("fs");

var jwt = require("jsonwebtoken");
var accessTokenSecret = "myAccessTokenSecret1234567890";

app.use("/public", express.static(__dirname + "/public"));
app.set("view engine", "ejs");

var socketIO = require("socket.io")(http);
const io = socketio(http);
var socketID = "";
var users = [];

var mainURL = "http://localhost:3000";

socketIO.on("connection", function (socket) {
  console.log("User connected", socket.id);
  socketID = socket.id;
});

http.listen(3000, function () {
  console.log("Server started at " + mainURL);

  mongoClient.connect(
    "mongodb://0.0.0.0:27017/mydb",
    { useUnifiedTopology: true },
    function (error, client) {
      var database = client.db("free_social_network");
      console.log("Database connected.");

      app.get("/pro-versions", function (request, result) {
        result.render("proVersions");
      });

      app.get("/profileViews", function (request, result) {
        result.render("profileViews");
      });

      app.get("/signup", function (request, result) {
        result.render("signup");
      });

      app.post("/signup", function (request, result) {
        var name = request.fields.name;
        var username = request.fields.username;
        var email = request.fields.email;
        var password = request.fields.password;
        var gender = request.fields.gender;
        var reset_token = "";

        database.collection("users").findOne(
          {
            $or: [
              {
                email: email,
              },
              {
                username: username,
              },
            ],
          },
          function (error, user) {
            if (user == null) {
              bcrypt.hash(password, 10, function (error, hash) {
                database.collection("users").insertOne(
                  {
                    name: name,
                    username: username,
                    email: email,
                    password: hash,
                    gender: gender,
                    reset_token: reset_token,
                    profileImage: "",
                    coverPhoto: "",
                    dob: "",
                    city: "",
                    country: "",
                    aboutMe: "",
                    friends: [],
                    pages: [],
                    notifications: [],
                    groups: [],
                    posts: [],
                  },
                  function (error, data) {
                    result.json({
                      status: "success",
                      message: "Signed up successfully. You can login now.",
                    });
                  }
                );
              });
            } else {
              result.json({
                status: "error",
                message: "Email or username already exist.",
              });
            }
          }
        );
      });

      app.get("/login", function (request, result) {
        result.render("login");
      });

      app.post("/login", function (request, result) {
        var email = request.fields.email;
        var password = request.fields.password;
        database.collection("users").findOne(
          {
            email: email,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "Email does not exist",
              });
            } else {
              bcrypt.compare(
                password,
                user.password,
                function (error, isVerify) {
                  if (isVerify) {
                    var accessToken = jwt.sign(
                      { email: email },
                      accessTokenSecret
                    );
                    database.collection("users").findOneAndUpdate(
                      {
                        email: email,
                      },
                      {
                        $set: {
                          accessToken: accessToken,
                        },
                      },
                      function (error, data) {
                        result.json({
                          status: "success",
                          message: "Login successfully",
                          accessToken: accessToken,
                          profileImage: user.profileImage,
                        });
                      }
                    );
                  } else {
                    result.json({
                      status: "error",
                      message: "Password is not correct",
                    });
                  }
                }
              );
            }
          }
        );
      });

      app.get("/user/:username", function (request, result) {
        database.collection("users").findOne(
          {
            username: request.params.username,
          },
          function (error, user) {
            if (user == null) {
              result.send({
                status: "error",
                message: "User does not exists",
              });
            } else {
              result.render("userProfile", {
                user: user,
              });
            }
          }
        );
      });

      app.get("/updateProfile", function (request, result) {
        result.render("updateProfile");
      });

      app.post("/getUser", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              result.json({
                status: "success",
                message: "Record has been fetched.",
                data: user,
              });
            }
          }
        );
      });

      app.get("/logout", function (request, result) {
        result.redirect("/login");
      });

      app.post("/uploadCoverPhoto", function (request, result) {
        var accessToken = request.fields.accessToken;
        var coverPhoto = "";

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.coverPhoto.size > 0 &&
                request.files.coverPhoto.type.includes("image")
              ) {
                if (user.coverPhoto != "") {
                  fileSystem.unlink(user.coverPhoto, function (error) {
                    //
                  });
                }

                coverPhoto =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.coverPhoto.name;

                // Read the file
                fileSystem.readFile(
                  request.files.coverPhoto.path,
                  function (err, data) {
                    if (err) throw err;
                    console.log("File read!");

                    // Write the file
                    fileSystem.writeFile(coverPhoto, data, function (err) {
                      if (err) throw err;
                      console.log("File written!");

                      database.collection("users").updateOne(
                        {
                          accessToken: accessToken,
                        },
                        {
                          $set: {
                            coverPhoto: coverPhoto,
                          },
                        },
                        function (error, data) {
                          result.json({
                            status: "status",
                            message: "Cover photo has been updated.",
                            data: mainURL + "/" + coverPhoto,
                          });
                        }
                      );
                    });

                    // Delete the file
                    fileSystem.unlink(
                      request.files.coverPhoto.path,
                      function (err) {
                        if (err) throw err;
                        console.log("File deleted!");
                      }
                    );
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Please select valid image.",
                });
              }
            }
          }
        );
      });

      app.post("/uploadProfileImage", function (request, result) {
        var accessToken = request.fields.accessToken;
        var profileImage = "";

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.profileImage.size > 0 &&
                request.files.profileImage.type.includes("image")
              ) {
                if (user.profileImage != "") {
                  fileSystem.unlink(user.profileImage, function (error) {
                    //
                  });
                }

                profileImage =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.profileImage.name;

                // Read the file
                fileSystem.readFile(
                  request.files.profileImage.path,
                  function (err, data) {
                    if (err) throw err;
                    console.log("File read!");

                    // Write the file
                    fileSystem.writeFile(profileImage, data, function (err) {
                      if (err) throw err;
                      console.log("File written!");

                      database.collection("users").updateOne(
                        {
                          accessToken: accessToken,
                        },
                        {
                          $set: {
                            profileImage: profileImage,
                          },
                        },
                        function (error, data) {
                          result.json({
                            status: "status",
                            message: "Profile image has been updated.",
                            data: mainURL + "/" + profileImage,
                          });
                        }
                      );
                    });

                    // Delete the file
                    fileSystem.unlink(
                      request.files.profileImage.path,
                      function (err) {
                        if (err) throw err;
                        console.log("File deleted!");
                      }
                    );
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Please select valid image.",
                });
              }
            }
          }
        );
      });

      app.post("/updateProfile", function (request, result) {
        var accessToken = request.fields.accessToken;
        var name = request.fields.name;
        var dob = request.fields.dob;
        var city = request.fields.city;
        var country = request.fields.country;
        var aboutMe = request.fields.aboutMe;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("users").updateOne(
                {
                  accessToken: accessToken,
                },
                {
                  $set: {
                    name: name,
                    dob: dob,
                    city: city,
                    country: country,
                    aboutMe: aboutMe,
                  },
                },
                function (error, data) {
                  result.json({
                    status: "status",
                    message: "Profile has been updated.",
                  });
                }
              );
            }
          }
        );
      });

      app.get("/post/:id", function (request, result) {
        database.collection("posts").findOne(
          {
            _id: ObjectId(request.params.id),
          },
          function (error, post) {
            if (post == null) {
              result.send({
                status: "error",
                message: "Post does not exist.",
              });
            } else {
              result.render("postDetail", {
                post: post,
              });
            }
          }
        );
      });

      app.get("/index", (req, res) => {
        res.render("index");
      });

      var bodyParse = require("body-parser");
      const path = require("path");
      app.use(express.static(path.join(__dirname, "public")));

      app.use(bodyParse.json());
      app.use(express.static("public"));
      app.use(
        bodyParse.urlencoded({
          extended: true,
        })
      );

      app.get("/", (req, res) => {
        res.set({
          "Allow-access-Allow-Origin": "*",
        });

        return res.redirect("index.html");
      });

      app.post("/addPost", function (request, result) {
        var accessToken = request.fields.accessToken;
        var caption = request.fields.caption;
        var image = "";
        var video = "";
        var type = request.fields.type;
        var createdAt = new Date().getTime();
        var _id = request.fields._id;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.image.size > 0 &&
                request.files.image.type.includes("image")
              ) {
                image =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.image.name;

                // Read the file
                fileSystem.readFile(
                  request.files.image.path,
                  function (err, data) {
                    if (err) throw err;
                    console.log("File read!");

                    // Write the file
                    fileSystem.writeFile(image, data, function (err) {
                      if (err) throw err;
                      console.log("File written!");
                    });

                    // Delete the file
                    fileSystem.unlink(request.files.image.path, function (err) {
                      if (err) throw err;
                      console.log("File deleted!");
                    });
                  }
                );
              }

              if (
                request.files.video.size > 0 &&
                request.files.video.type.includes("video")
              ) {
                video =
                  "public/videos/" +
                  new Date().getTime() +
                  "-" +
                  request.files.video.name;

                // Read the file
                fileSystem.readFile(
                  request.files.video.path,
                  function (err, data) {
                    if (err) throw err;
                    console.log("File read!");

                    // Write the file
                    fileSystem.writeFile(video, data, function (err) {
                      if (err) throw err;
                      console.log("File written!");
                    });

                    // Delete the file
                    fileSystem.unlink(request.files.video.path, function (err) {
                      if (err) throw err;
                      console.log("File deleted!");
                    });
                  }
                );
              }

              database.collection("posts").insertOne(
                {
                  caption: caption,
                  image: image,
                  video: video,
                  type: type,
                  createdAt: createdAt,
                  likers: [],
                  comments: [],
                  shares: [],
                  user: {
                    _id: user._id,
                    name: user.name,
                    username: user.username,
                    profileImage: user.profileImage,
                  },
                },
                function (error, data) {
                  database.collection("users").updateOne(
                    {
                      accessToken: accessToken,
                    },
                    {
                      $push: {
                        posts: {
                          _id: data.insertedId,
                          caption: caption,
                          image: image,
                          video: video,
                          type: type,
                          createdAt: createdAt,
                          likers: [],
                          comments: [],
                          shares: [],
                        },
                      },
                    },
                    function (error, data) {
                      result.json({
                        status: "success",
                        message: "Post has been uploaded.",
                      });
                    }
                  );
                }
              );
            }
          }
        );
      });

      app.post("/getNewsfeed", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              var ids = [];
              ids.push(user._id);

              database
                .collection("posts")
                .find({
                  "user._id": {
                    $in: ids,
                  },
                })
                .sort({
                  createdAt: -1,
                })
                .limit(5)
                .toArray(function (error, data) {
                  result.json({
                    status: "success",
                    message: "Record has been fetched",
                    data: data,
                  });
                });
            }
          }
        );
      });

      app.post("/toggleLikePost", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("posts").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, post) {
                  if (post == null) {
                    result.json({
                      status: "error",
                      message: "Post does not exist.",
                    });
                  } else {
                    var isLiked = false;
                    for (var a = 0; a < post.likers.length; a++) {
                      var liker = post.likers[a];

                      if (liker._id.toString() == user._id.toString()) {
                        isLiked = true;
                        break;
                      }
                    }

                    if (isLiked) {
                      database.collection("posts").updateOne(
                        {
                          _id: ObjectId(_id),
                        },
                        {
                          $pull: {
                            likers: {
                              _id: user._id,
                            },
                          },
                        },
                        function (error, data) {
                          database.collection("users").updateOne(
                            {
                              $and: [
                                {
                                  _id: post.user._id,
                                },
                                {
                                  "posts._id": post._id,
                                },
                              ],
                            },
                            {
                              $pull: {
                                "posts.$[].likers": {
                                  _id: user._id,
                                },
                              },
                            }
                          );

                          result.json({
                            status: "unliked",
                            message: "Post has been unliked.",
                          });
                        }
                      );
                    } else {
                      database.collection("users").updateOne(
                        {
                          _id: post.user._id,
                        },
                        {
                          $push: {
                            notifications: {
                              _id: ObjectId(),
                              type: "photo_liked",
                              content: user.name + " has liked your post.",
                              profileImage: user.profileImage,
                              isRead: false,
                              post: {
                                _id: post._id,
                              },
                              createdAt: new Date().getTime(),
                            },
                          },
                        }
                      );

                      database.collection("posts").updateOne(
                        {
                          _id: ObjectId(_id),
                        },
                        {
                          $push: {
                            likers: {
                              _id: user._id,
                              name: user.name,
                              profileImage: user.profileImage,
                            },
                          },
                        },
                        function (error, data) {
                          database.collection("users").updateOne(
                            {
                              $and: [
                                {
                                  _id: post.user._id,
                                },
                                {
                                  "posts._id": post._id,
                                },
                              ],
                            },
                            {
                              $push: {
                                "posts.$[].likers": {
                                  _id: user._id,
                                  name: user.name,
                                  profileImage: user.profileImage,
                                },
                              },
                            }
                          );

                          result.json({
                            status: "success",
                            message: "Post has been liked.",
                          });
                        }
                      );
                    }
                  }
                }
              );
            }
          }
        );
      });

      app.post("/postComment", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        var comment = request.fields.comment;
        var createdAt = new Date().getTime();

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("posts").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, post) {
                  if (post == null) {
                    result.json({
                      status: "error",
                      message: "Post does not exist.",
                    });
                  } else {
                    var commentId = ObjectId();

                    database.collection("posts").updateOne(
                      {
                        _id: ObjectId(_id),
                      },
                      {
                        $push: {
                          comments: {
                            _id: commentId,
                            user: {
                              _id: user._id,
                              name: user.name,
                              profileImage: user.profileImage,
                            },
                            comment: comment,
                            createdAt: createdAt,
                            replies: [],
                          },
                        },
                      },
                      function (error, data) {
                        if (user._id.toString() != post.user._id.toString()) {
                          database.collection("users").updateOne(
                            {
                              _id: post.user._id,
                            },
                            {
                              $push: {
                                notifications: {
                                  _id: ObjectId(),
                                  type: "new_comment",
                                  content:
                                    user.name + " commented on your post.",
                                  profileImage: user.profileImage,
                                  post: {
                                    _id: post._id,
                                  },
                                  isRead: false,
                                  createdAt: new Date().getTime(),
                                },
                              },
                            }
                          );
                        }

                        database.collection("users").updateOne(
                          {
                            $and: [
                              {
                                _id: post.user._id,
                              },
                              {
                                "posts._id": post._id,
                              },
                            ],
                          },
                          {
                            $push: {
                              "posts.$[].comments": {
                                _id: commentId,
                                user: {
                                  _id: user._id,
                                  name: user.name,
                                  profileImage: user.profileImage,
                                },
                                comment: comment,
                                createdAt: createdAt,
                                replies: [],
                              },
                            },
                          }
                        );

                        database.collection("posts").findOne(
                          {
                            _id: ObjectId(_id),
                          },
                          function (error, updatePost) {
                            result.json({
                              status: "success",
                              message: "Comment has been posted.",
                              updatePost: updatePost,
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });

      app.post("/postReply", function (request, result) {
        var accessToken = request.fields.accessToken;
        var postId = request.fields.postId;
        var commentId = request.fields.commentId;
        var reply = request.fields.reply;
        var createdAt = new Date().getTime();

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("posts").findOne(
                {
                  _id: ObjectId(postId),
                },
                function (error, post) {
                  if (post == null) {
                    result.json({
                      status: "error",
                      message: "Post does not exist.",
                    });
                  } else {
                    var replyId = ObjectId();

                    database.collection("posts").updateOne(
                      {
                        $and: [
                          {
                            _id: ObjectId(postId),
                          },
                          {
                            "comments._id": ObjectId(commentId),
                          },
                        ],
                      },
                      {
                        $push: {
                          "comments.$.replies": {
                            _id: replyId,
                            user: {
                              _id: user._id,
                              name: user.name,
                              profileImage: user.profileImage,
                            },
                            reply: reply,
                            createdAt: createdAt,
                          },
                        },
                      },
                      function (error, data) {
                        database.collection("users").updateOne(
                          {
                            $and: [
                              {
                                _id: post.user._id,
                              },
                              {
                                "posts._id": post._id,
                              },
                              {
                                "posts.comments._id": ObjectId(commentId),
                              },
                            ],
                          },
                          {
                            $push: {
                              "posts.$[].comments.$[].replies": {
                                _id: replyId,
                                user: {
                                  _id: user._id,
                                  name: user.name,
                                  profileImage: user.profileImage,
                                },
                                reply: reply,
                                createdAt: createdAt,
                              },
                            },
                          }
                        );

                        database.collection("posts").findOne(
                          {
                            _id: ObjectId(postId),
                          },
                          function (error, updatePost) {
                            result.json({
                              status: "success",
                              message: "Reply has been posted.",
                              updatePost: updatePost,
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });

      app.post("/sharePost", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        var type = "shared";
        var createdAt = new Date().getTime();

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("posts").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, post) {
                  if (post == null) {
                    result.json({
                      status: "error",
                      message: "Post does not exist.",
                    });
                  } else {
                    database.collection("posts").updateOne(
                      {
                        _id: ObjectId(_id),
                      },
                      {
                        $push: {
                          shares: {
                            _id: user._id,
                            name: user.name,
                            profileImage: user.profileImage,
                          },
                        },
                      },
                      function (error, data) {
                        database.collection("posts").insertOne(
                          {
                            caption: post.caption,
                            image: post.image,
                            video: post.video,
                            type: type,
                            createdAt: createdAt,
                            likers: [],
                            comments: [],
                            shares: [],
                            user: {
                              _id: user._id,
                              name: user.name,
                              gender: user.gender,
                              profileImage: user.profileImage,
                            },
                          },
                          function (error, data) {
                            database.collection("users").updateOne(
                              {
                                $and: [
                                  {
                                    _id: post.user._id,
                                  },
                                  {
                                    "posts._id": post._id,
                                  },
                                ],
                              },
                              {
                                $push: {
                                  "posts.$[].shares": {
                                    _id: user._id,
                                    name: user.name,
                                    profileImage: user.profileImage,
                                  },
                                },
                              }
                            );

                            result.json({
                              status: "success",
                              message: "Post has been shared.",
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });

      app.get("/search/:query", function (request, result) {
        var query = request.params.query;
        result.render("search", {
          query: query,
        });
      });

      app.post("/search", function (request, result) {
        var query = request.fields.query;
        database
          .collection("users")
          .find({
            name: {
              $regex: ".*" + query + ".*",
              $options: "i",
            },
          })
          .toArray(function (error, data) {
            result.json({
              status: "success",
              message: "Record has been fetched",
              data: data,
            });
          });
      });

      app.get("/friends", function (request, result) {
        result.render("friends");
      });

      app.get("/inbox", function (request, result) {
        result.render("inbox");
      });

      app.get("/pages", function (request, result) {
        result.render("pages");
      });

      app.get("/groups", function (request, result) {
        result.render("groups");
      });

      app.get("/notifications", function (request, result) {
        result.render("notifications");
      });

      // ==================================================

      const formatMessage = require("./utils/messages");
      const createAdapter = require("@socket.io/redis-adapter").createAdapter;
      const redis = require("redis");
      require("dotenv").config();
      const { createClient } = redis;
      const {
        userJoin,
        getCurrentUser,
        userLeave,
        getRoomUsers,
      } = require("./utils/users");

      app.use(express.static(path.join(__dirname, "public")));

      // chat application

      // Set static folder

      const botName = "Pikadex Chat";

      // Run when client connects
      io.on("connection", (socket) => {
        console.log(io.of("/").adapter);
        socket.on("joinRoom", ({ username, room }) => {
          const user = userJoin(socket.id, username, room);

          socket.join(user.room);

          // Welcome current user
          socket.emit(
            "messages",
            formatMessage(botName, "Welcome to ChatCord!")
          );

          // Broadcast when a user connects
          socket.broadcast
            .to(user.room)
            .emit(
              "message",
              formatMessage(botName, `${user.username} has joined the chat`)
            );

          // Send users and room info
          io.to(user.room).emit("roomUsers", {
            room: user.room,
            users: getRoomUsers(user.room),
          });
        });

        // Listen for chatMessage
        socket.on("chatMessage", (msg) => {
          const user = getCurrentUser(socket.id);

          io.to(user.room).emit("message", formatMessage(user.username, msg));
        });

        // Runs when client disconnects
        socket.on("disconnect", () => {
          const user = userLeave(socket.id);

          if (user) {
            io.to(user.room).emit(
              "message",
              formatMessage(botName, `${user.username} has left the chat`)
            );

            // Send users and room info
            io.to(user.room).emit("roomUsers", {
              room: user.room,
              users: getRoomUsers(user.room),
            });
          }
        });
      });

      //To-Do

      app.set("view engine", "ejs");
      app.use(express.static("public"));
      app.use(bodyParse.urlencoded({ extended: true }));

    //   mongoose.connect("mongodb://0.0.0.0:27017/mydb", {
    //     useNewUrlParser: true,
    //     useUnifiedTopology: true,
    //   });

      const itemSchema = {
        name: String,
      };
    //   const Item = mongoose.model("Item", itemSchema);

    //   const item1 = new Item({
    //     name: "Meditation",
    //   });
    //   const item2 = new Item({
    //     name: "Gym",
    //   });
    //   const item3 = new Item({
    //     name: "Breakfast",
    //   });
    //   const defaultItems = [item1, item2, item3];

      app.get("/todo", function (req, res) {
        Item.find({})
          .exec()
          .then((foundItems) => {
            res.render("list", { newListItems: foundItems });
          })
          .catch((err) => {
            console.log(err);
          });
      });

      app.get("/todo", function (req, res) {
        Item.find()
          .then(function (foundItems) {
            res.render("list", { newListItems: foundItems });
          })
          .catch(function (err) {
            console.log(err);
          });
      });

      app.get("/todo", async function (req, res) {
        try {
          const newListItems = await Item.find({}).exec();
          res.render("list", { newListItems });
        } catch (error) {
          // Handle the error
          console.log(error);
          res.status(500).send("Internal Server Error");
        }
      });

      app.post("/", function (req, res) {
        const itemName = req.body.n;
        //console.log(i);
        //i1.push(i);
        //res.render("list",{newListItem:i});
        // res.redirect("/");
        const item = new Item({
          name: itemName,
        });
        item.save();
        res.redirect("/todo");
      });
      //

      app.post("/delete", async function (req, res) {
        try {
          const check = req.body.checkbox;
          await Item.findByIdAndRemove(check);
          res.redirect("/todo");
        } catch (error) {
          // Handle the error
          console.log(error);
          res.status(500).send("Internal Server Error");
        }
      });

      // ===================================================
      app.post("/markNotificationsAsRead", function (request, result) {
        var accessToken = request.fields.accessToken;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("users").updateMany(
                {
                  $and: [
                    {
                      accessToken: accessToken,
                    },
                    {
                      "notifications.isRead": false,
                    },
                  ],
                },
                {
                  $set: {
                    "notifications.$.isRead": true,
                  },
                },
                function (error, data) {
                  result.json({
                    status: "success",
                    message: "Notifications has been marked as read.",
                  });
                }
              );
            }
          }
        );
      });

      app.get(
        "/verifyEmail/:email/:verification_token",
        function (request, result) {
          // Paid version only
          // Please read "How to install.txt" to get full version.
        }
      );

      app.get("/ResetPassword/:email/:reset_token", function (request, result) {
        // Paid version only
        // Please read "How to install.txt" to get full version.
      });

      app.get("/forgot-password", function (request, result) {
        // Paid version only
        // Please read "How to install.txt" to get full version.
        result.render("forgot-password");
      });

      app.post("/sendRecoveryLink", function (request, result) {
        // Paid version only
        // Please read "How to install.txt" to get full version.
      });

      app.post("/changePassword", function (request, result) {
        // Paid version only
        // Please read "How to install.txt" to get full version.
      });

      app.post("/sendMessage", function (request, result) {
        // Paid version only
        // Please read "How to install.txt" to get full version.
      });

      app.post("/connectSocket", function (request, result) {
        // Paid version only
        // Please read "How to install.txt" to get full version.
      });

      app.post("/toggleJoinGroup", function (request, result) {
        // Paid version only
        // Please read "How to install.txt" to get full version.
      });

      app.post("/sendFriendRequest", function (request, result) {
        // Paid version only
        // Please read "How to install.txt" to get full version.
      });

      app.post("/acceptFriendRequest", function (request, result) {
        // Paid version only
        // Please read "How to install.txt" to get full version.
      });
    }
  );
});
