var collection;

var repositories = [
    {
        username: 'mtford90',
        name: 'Silk',
        description: 'Silky smooth profiling for Django.',
        watchers: 10,
        stars: 20,
        forks: 30,
        profilePhoto: 'https://avatars3.githubusercontent.com/u/1734057?v=2&s=40'
    },
    {
        username: 'bob',
        name: 'A Repo',
        description: 'Description of some Repo',
        watchers: 2,
        stars: 1043,
        forks: 43,
        profilePhoto: 'https://avatars3.githubusercontent.com/u/1734057?v=2&s=40'
    },
    {
        username: 'mike',
        name: 'Random Repo',
        description: 'SOME RANDOM DESCRIPTION',
        watchers: 43,
        stars: 134,
        forks: 23,
        profilePhoto: 'https://avatars3.githubusercontent.com/u/1734057?v=2&s=40'
    },
    {
        username: 'xfdadf',
        name: '1309409sudjf',
        description: 'ckvjbxivbjw',
        watchers: 433,
        stars: 3,
        forks: 223,
        profilePhoto: 'https://avatars3.githubusercontent.com/u/1734057?v=2&s=40'
    },
    {
        username: 'sd0sdf',
        name: '94rhvksdf',
        description: 'sdfsd uisdf sdf sdf',
        watchers: 3,
        stars: 56,
        forks: 1,
        profilePhoto: 'https://avatars3.githubusercontent.com/u/1734057?v=2&s=40'
    }
];

function createRepoElement(opts) {
    var cloned = $('#template').clone();
    cloned.css('display', 'inherit');
    cloned.find('.user .username').text(opts.username);
    cloned.find('h3.name').text(opts.name);
    cloned.find('.description').text(opts.description);
    cloned.find('.watchers .num').text(opts.watchers);
    cloned.find('.stars .num').text(opts.stars);
    cloned.find('.forks .num').text(opts.forks);
    cloned.find('img').attr('src', opts.profilePhoto);
    var rows = $('#content .row');
    var row;
    for (var i = 1; i < rows.length; i++) {
        row = rows[i];
        if ($(row).children().length < 4) break;
        else row = null;
    }
    if (!row) row = $('<div class="row"></div>');
    $('#content').append(row);
    $(row).append(cloned);
}

function getRepos() {
    _.each(repositories, createRepoElement);
}

function init() {
    collection = new siesta.Collection('MyCollection');
    collection.baseURL = 'https://api.github.com';
    var Repo = collection.mapping('Repo', {
        id: 'id',
        attributes: ['name', 'full_name', 'description'],
        relationships: {
            owner: {
                mapping: 'User',
                type: 'OneToMany',
                reverse: 'repositories'
            }
        }
    });
    var User = collection.mapping('User', {
        id: 'id',
        attributes: ['login']
    });
    collection.responseDescriptor({
        path: '/repositories',
        mapping: Repo,
        method: 'GET'
    });
    collection.install(function (err) {
        if (!err) {
            getRepos();
        }
        else {
            console.error(err);
        }
    });
}

window.onload = init;

function showStats() {
    var stats = '<ul><li>There are 5 repositories distributed across 12 users<li></ul>';
    sweetAlert('Statistics', stats)
}