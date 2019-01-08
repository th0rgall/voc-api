var chai = require('chai');
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = require('chai').expect;

var username = 'tomtesterom';
var password = 'zeeronveilig'; 

describe('Vocabulary API', function() {

    var VocAPI = require('../vocabulary-api');
    var voc = new VocAPI();

    function clearLists() {
        return voc.getLists().then(lists => lists.forEach(l => voc.deleteList(l.wordlistid).then()));
    }

    before(() => {
        return voc.login(username, password).then(() => {//clearLists();
        });
    })

    describe('#addToNewList() and #deleteList()', function() {
        let newId;
        
        it('should add a new list', function() {
            return expect(
                voc.addToNewList([{word: 'test'}], "New List", "A new list", false)
                .then((res) => {
                    newId = res.listId; // set new id to var
                    return voc.getLists(lists => lists.find(l => l.wordlistid == newId));
                })
            ).to.eventually.be.ok;


        });

        it('should delete an added list', function() {
            let deletedId;
            return expect(
                voc.addToNewList([{word: 'test'}], "New List", "A new list", false)
                .then( res => {deletedId = res.listId; return voc.deleteList(deletedId)}) // todo: improve by adding in then
                .then(( res ) => {
                    return voc.getLists().then(lists => {
                        return lists.find(l => l.wordlistid === deletedId);
                    });
                    // 
                })
            ).to.eventually.be.not.ok;
        });

        //      I think the list always exists, but is softly removed from account (as proven above)
        //      it('test2', function() {
        //     return expect(voc.deleteList(newId).then( () => 
        //         {return voc.getList(newId)} )).to.be.eventually.rejectedWith(Error);
        // })


    });

    describe('#addToList()', function() {

        var existingListId = 2764902; 

        it('should add a single existing word to existing list', function() {
            return expect(
                voc.addToList([{word: "megalomania"}], existingListId)
                .then((result) => {
                    return voc.getList(result.listId)
                })
                .then(list => list.words.find(w => w.word === "megalomania"))
            ).to.eventually.be.ok;
        });

        it('should add a multiple existing words to existing list', function() {
            return expect(
                voc.addToList([{word: "megalomania"}, {word: "roost"}], existingListId)
                .then((result) => {
                    return voc.getList(result.listId)
                })
                .then(list => list.words.find(w => w.word === "megalomania") 
                        && list.words.find(w => w.word === "roost"))
            ).to.eventually.be.ok;
        });
    });

    describe('#checkLogin()', function() {

        it('should return false when not logged in', () => {
            const vocA = new VocAPI();
            return expect(vocA.logout().then(() => vocA.checkLogin())).to.be.rejectedWith('not logged in');
        });

        it('should return true when logged in', () => {
            const vocB = new VocAPI();
            
            return expect(
                vocB.login(username, password).then(() => vocB.checkLogin())
            ).to.be.become(true);
        });
    })
});
