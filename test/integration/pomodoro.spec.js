var s = require('../../core/index'),
    assert = require('chai').assert;

/*globals describe, it, beforeEach, before, after */
describe('pomodoro', function () {


    var Type = {
        Task: 'Task'
    };

    var DEFAULT_COLOURS = {
        primary: '#df423c',
        shortBreak: '#37a2c4',
        longBreak: '#292f37'
    };

    describe('rq', function () {
        var Pomodoro, Task;
        beforeEach(function (done) {
            s.reset(function () {
                Pomodoro = siesta.collection('Pomodoro');
                Task = Pomodoro.model(Type.Task, {
                    attributes: [
                        'title',
                        'description',
                        'completed',
                        'editing',
                        'index'
                    ]
                });
                s.install(done);
            });
        });

        it('sad', function (done) {
            var incompleteTasks = Task.reactiveQuery({completed: false});
            incompleteTasks.orderBy('index');
            incompleteTasks.init().then(function () {
                incompleteTasks.once('change', function () {
                    done();
                });
                Task.map({title: 'title', description: 'an awesome description', completed: false})
                    .catch(done)
                    .done();
            }).catch(done).done();
        });
    });

    describe('config', function () {
        var Pomodoro, Config, ColourConfig, PomodoroConfig;
        beforeEach(function (done) {
            s.reset(function () {
                s.ext.storageEnabled = true;
                Pomodoro = siesta.collection('Pomodoro');
                Config = Pomodoro.model('Config', {
                    relationships: {
                        pomodoro: {model: 'PomodoroConfig'},
                        colours: {model: 'ColourConfig'}
                    },
                    singleton: true
                });
                ColourConfig = Pomodoro.model('ColourConfig', {
                    attributes: [
                        {
                            name: 'primary',
                            default: DEFAULT_COLOURS.primary
                        },
                        {
                            name: 'shortBreak',
                            default: DEFAULT_COLOURS.shortBreak
                        },
                        {
                            name: 'longBreak',
                            default: DEFAULT_COLOURS.longBreak
                        }
                    ],
                    singleton: true
                });
                PomodoroConfig = Pomodoro.model('PomodoroConfig', {
                    attributes: [
                        {
                            name: 'pomodoroLength',
                            default: 25
                        },
                        {
                            name: 'longBreakLength',
                            default: 15
                        },
                        {
                            name: 'shortBreakLength',
                            default: 5
                        },
                        {
                            name: 'roundLength',
                            default: 4
                        }
                    ],
                    singleton: true
                });
                done();
            });
        });


        it('load, ColourConfig', function (done) {
            s.ext.storage._pouch.put({
                collection: 'Pomodoro',
                model: 'ColourConfig',
                primary: 'red',
                shortBreak: 'blue',
                longBreak: 'green',
                _id: 'xyz'
            }).then(function () {
                s.install(function () {
                    ColourConfig.get()
                        .then(function (colourConfig) {
                            assert.equal(colourConfig.primary, 'red');
                            assert.equal(colourConfig.shortBreak, 'blue');
                            assert.equal(colourConfig.longBreak, 'green');
                            done();
                        })
                        .catch(done)
                        .done();
                });
            }).catch(done);

        });

        it('load, Config', function (done) {
            s.ext.storage._pouch.put({
                collection: 'Pomodoro',
                model: 'ColourConfig',
                primary: 'red',
                shortBreak: 'blue',
                longBreak: 'green',
                _id: 'xyz'
            }).then(function () {
                s.install(function () {
                    Config.get()
                        .then(function (config) {
                            var colourConfig = config.colours;
                            assert.equal(colourConfig.primary, 'red');
                            assert.equal(colourConfig.shortBreak, 'blue');
                            assert.equal(colourConfig.longBreak, 'green');
                            done();
                        })
                        .catch(done)
                        .done();
                });
            }).catch(done);
        });

        it('repeated saves', function (done) {
            s.ext.storage._pouch.put({
                collection: 'Pomodoro',
                model: 'ColourConfig',
                primary: 'red',
                shortBreak: 'blue',
                longBreak: 'green',
                _id: 'xyz'
            }).then(function () {
                s.install(function () {
                    Config.get()
                        .then(function (config) {
                            var colourConfig = config.colours;
                            colourConfig.primary = 'blue';
                            s.save()
                                .then(function () {
                                    colourConfig.primary = 'orange';
                                    s.save().then(function () {
                                        s.ext.storage._pouch.query(function (doc) {
                                            if (doc.model == 'ColourConfig') {
                                                emit(doc._id, doc);
                                            }
                                        },{include_docs: true})
                                            .then(function (resp) {
                                                var rows = resp.rows;
                                                console.log('rows', rows);
                                                assert.equal(rows.length, 1, 'Should only ever be one row for singleton');
                                                done();
                                            })
                                            .catch(done);
                                    }).catch(done);
                                })
                                .catch(done);
                        })
                        .catch(done)
                        .done();
                });
            }).catch(done);
        });
    });


});