var s = require('../core/index'),
    assert = require('chai').assert;

describe('recursive relationships', function () {

    var cache = require('../core/cache');

    var Collection, Repo;

    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(function () {
            Collection = s.collection('MyCollection');
            Collection.baseURL = 'https://api.github.com';
            Repo = Collection.model('Repo', {
                id: 'id',
                attributes: ['name'],
                relationships: {
                    forkedFrom: {
                        model: 'Repo',
                        type: 'OneToMany',
                        reverse: 'forks'
                    }
                }
            });
            done();
        });
    });

    it('map', function (done) {
        var masterRepoData = {id: '5', name: 'Master Repo'};
        Repo.map(masterRepoData, function (err, repo) {
            if (err) {
                done(err);
            }
            else {
                var childRepoData = {id: '6', name: 'Child Repo', forkedFrom: {_id: repo._id}};
                Repo.map(childRepoData, function (err, childRepo) {
                    if (err) {
                        done(err);
                    }
                    else {
                        assert.include(repo.forks, childRepo);
                        assert.equal(childRepo.forkedFrom, repo);
                        done();
                    }
                });
            }
        });
    });

});