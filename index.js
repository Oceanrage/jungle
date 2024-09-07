function triggerMouseEvent (node, eventType) {
    var clickEvent = new Event(eventType, { bubbles: true, cancelable: true });
    node.dispatchEvent (clickEvent);
}

async function httpClient(object_id, position, game_type = 0) {
    const params = {
        object_id,
        position,
        game_type,
        _fs2ajax: 1,
    };
    const queryString = new URLSearchParams(params).toString();
    console.log('Query string: ' + queryString);
    
    const response = await fetch('/jungleStory2019/gameBoard/makeMove/', {
        method: 'POST',
        body: queryString,
        headers: {
            'Content-type': 'application/x-www-form-urlencoded',
        },
    });

    const data = await response;
    //console.log(data);
    //console.log(data.body);
    
    return data.ok;
}

class RHSolver {    
    constructor(board = null) {
        Object.assign(this, {
            board: board,
            queue: [],
            spent: [],
            result: null,
            combinations: 0,
        });
    }

    log(msg = '') {
        console.log('RHSolver: ' + String(msg));
    }

    getBoard() {
        return this.board;
    }

    strReplace(str, index, replacement) {
        return str.substr(0, index) + replacement + str.substr(index + replacement.length);
    }

    checkBoard(board) {
        return (
            typeof board === 'string' && board.length === 36
            && board.indexOf('AA') >= 12 && board.indexOf('AA') <= 16 && (board.match(/AA/g) || []).length === 1
        );
    }

    isWinPosition(board) {
        return board.indexOf('AA') === 16;
    }

    isCarAtPosition(board, i) {
        return (board.charAt(i).match(/[A-Z]/) && true);
    }

    getCarName(board, i) {
        return board.charAt(i);
    }

    carIsHorizontal(board, carName) {
        return (3 > (board.lastIndexOf(carName) - board.indexOf(carName)));
    }

    countSpaces(board, carName, cellNumber, vStep,  hStep) {
        let isHCar = this.carIsHorizontal(board, carName);
        if ((isHCar && hStep === 0) || (!isHCar && vStep === 0)) {
            return 0;
        }

        let step = (isHCar ? 1 : 6) * (isHCar ? hStep : vStep),
            freeSpaces = 0,
            row = Math.floor(cellNumber / 6),
            column = cellNumber % 6;

        for (let i=1;;) {
            let pos = cellNumber + step * i;
            if (pos < 0 || pos > 35) break;

            let sym = board.charAt(pos);
            if (sym === carName) {
                cellNumber = pos;
                continue;
            }
            if (sym !== '.' || (isHCar && row !== Math.floor(pos / 6)) || (!isHCar && column !== pos % 6)) break;

            freeSpaces = i++;
        }

        return freeSpaces;
    }

    getCarLength(board, carName) {
        let re = new RegExp(carName, 'g');
        return (board.match(re) || []).length;
    }

    slideCar(state, carName, cellNumber, freeSpaces, vStep, hStep) {
        let board = state.board,
            isHCar = this.carIsHorizontal(board, carName),
            carLength = this.getCarLength(board, carName);
        if (freeSpaces === 0 || (isHCar && hStep === 0) || (!isHCar && vStep === 0)) {
            return;
        }

        let step = (isHCar ? 1 : 6) * (isHCar ? hStep : vStep),
            newBoard = board.slice(0);

        for (let i = 1; i <= freeSpaces;) {
            let pos = cellNumber + (step * i);

            let sym = board.charAt(pos);
            if (sym === carName) {
                cellNumber = pos;
                continue;
            }

            newBoard = this.strReplace(newBoard, pos, carName);
            let leftPos = pos - (carLength * (isHCar ? 1 : 6) * (isHCar ? hStep : vStep));
            newBoard = this.strReplace(newBoard, leftPos, '.');

            this.queue.push({
                board: newBoard,
                steps: state.steps + i,
                moves: state.moves + 1,
                solution: [...state.solution, carName + (step > 0 ? '+' : '-') + i],
            });
            this.combinations++;

            if (this.isWinPosition(newBoard)) {
                return true;
            }

            i++;
        }

        return false;
    }

    exploreCar(state, carName, cellNumber) {
        let freeTopSpaces    = this.countSpaces(state.board, carName, cellNumber, -1,  0),
            freeRightSpaces  = this.countSpaces(state.board, carName, cellNumber,  0, +1),
            freeBottomSpaces = this.countSpaces(state.board, carName, cellNumber, +1,  0),
            freeLeftSpaces   = this.countSpaces(state.board, carName, cellNumber,  0, -1);

        return (this.slideCar(state, carName, cellNumber, freeTopSpaces,    -1,  0) ||
            this.slideCar(state, carName, cellNumber, freeRightSpaces,   0, +1) ||
            this.slideCar(state, carName, cellNumber, freeBottomSpaces, +1,  0) ||
            this.slideCar(state, carName, cellNumber, freeLeftSpaces,    0, -1))
    }

    solve() {
        let board = this.getBoard();

        if (!this.checkBoard(board)) {
            this.log('Board defined not propertly!');
            return false;
        }

        let state = {
            board: board,
            steps: 0,
            moves: 0,
            solution: [],
        };

        this.queue.push(state);

        let timeStart = performance.now();
        
        t1: while (this.queue.length > 0) {
            let state = this.queue.shift(),
                board = state.board;
            if (this.spent.indexOf(board) > -1) continue; // skip if this state already investigate
            
            this.spent.unshift(board);
            this.combinations++;

            if (this.isWinPosition(board)) {
                state.time = performance.now() - timeStart;
                state.combinations = this.combinations;
                this.result = state;
                break;
            }

            let cars = [];
            for (let i=0; i<36; i++) {
                if (this.isCarAtPosition(board, i)) {
                    let carName = this.getCarName(board, i);
                    if (cars.indexOf(carName) > -1) continue;
                    cars.unshift(carName);

                    if(this.exploreCar(state, carName, i)) {
                        state = this.queue.pop();
                        state.time = performance.now() - timeStart;
                        state.combinations = this.combinations;
                        this.result = state;
                        break t1;
                    }
                }
            }
        }

        return this.result;
    }
};

class PageHelper {
    constructor() {
        this.board = null;
    }

    log(msg = '') {
        console.log('PageHelper: ' + msg);
    }

    strReplace (str, index, replacement) {
        return str.substr(0, index) + replacement + str.substr(index + replacement.length);
    }

    getBoard() {
        let data = window.App?.$el?.__vue__?.$root?.$serviceData;
        if (!data) return false;
        let template = data.users_game_data ? data.users_game_data[data.user_model?.user_id]?.cur_game_board_string : false;
        if (template) {
            template = template.replace(/o/g, '.')
        }
        
        let board = document.querySelector(".board__wrapper");
        if (board === null) {
            this.log('Игровое поле не найдено');
            return false;
        }

        let pieces = this.findPieces(board);
        if (!pieces) {
            this.log('Не могу найти элементы на поле');
            return false;
        }

        return this.setPieceNames(pieces, template);
    }

    findPieces(board) {
        let pieces = null;
        if(board instanceof HTMLElement) {
            pieces = board.querySelectorAll('.piece');
        }
        return pieces;
    }

    findPieceByName(pieceName, board) {
        let piece = null;
        if(board instanceof HTMLElement) {
            let pieces = board.querySelectorAll('.piece:not(.piece_clon)');
            for (let i=0; i<pieces.length; i++) {
                if (pieces[i].textContent === pieceName) {
                    piece = pieces[i];
                    break;
                }
            }
        }
        return piece;
    }

    getObjectIdByName(pieceName, board) {
        let id = null;
        if(board instanceof HTMLElement) {
            let piece = board.querySelector(`.piece[data-name="${pieceName}"]:not(.piece_clon)`);
            //console.log(piece);
            if (piece && piece.dataset.oid) id = parseInt(piece.dataset.oid);
        }
        if (id !== null) return id;

        if (pieceName === 'A') return 0;

        if(board instanceof HTMLElement) {
            let pieces = board.querySelectorAll('.piece:not(.piece_clon)'),
                index = 1;
        t1: for (let y=0; y<6; y++) {
                for (let x=0; x<6; x++) {
                    for (let i=0; i<pieces.length; i++) {
                        let isH = 'h' == pieces[i].classList.value.match(/piece_(h|v)\d/)[1],
                            inPos = this.pieceAtPosition(pieces[i], x, y);
                        if (isH && inPos) {
                            if (pieces[i].textContent === pieceName) {
                                id = index;
                                break t1;
                            }
                            if (pieces[i].textContent !== 'A') index++;
                        }
                    }
                }
            }
            
        t2: for (let x=0; x<6; x++) {
                for (let y=0; y<6; y++) {
                    for (let i=0; i<pieces.length; i++) {
                        let isH = 'h' == pieces[i].classList.value.match(/piece_(h|v)\d/)[1],
                            inPos = this.pieceAtPosition(pieces[i], x, y);
                        if (!isH && inPos) {
                            if (pieces[i].textContent === pieceName) {
                                id = index;
                                break t2;
                            }
                            if (pieces[i].textContent !== 'A') index++;
                        }
                    }
                }
            }
        }
        return id;
    }

    getPieceNewPosition(piece, direction, walkSteps) {
        let position = -1,
            steps = parseInt(walkSteps);
        //console.log(piece, direction, walkSteps);
        let currentPosition = Math.round(parseFloat(piece.style.left)/100*6) + (6 * Math.round(parseFloat(piece.style.top)/100*6));
        //console.log('current position: ' + currentPosition);
        let isH = 'h' == piece.classList.value.match(/piece_(h|v)\d/)[1];
        if (direction === '+') {
            position = (isH) ? currentPosition + steps : currentPosition + (6 * steps);
        } else {
            position = (isH) ? currentPosition - steps : currentPosition - (6 * steps);
        }
        return position;
    }

    getObjectIdAndNewPosition(step, i) {
        let board = document.querySelector(".board__wrapper");
        
        if (!this.piecesPositions || i === 0) {
            this.piecesPositions = [];
            let pieces = this.findPieces(board);
            pieces.forEach(piece => this.piecesPositions.push({
                oid: parseInt(piece.dataset.oid),
                name: piece.dataset.name,
                position: parseInt(piece.dataset.position),
                type: piece.classList.value.match(/piece_(h|v)\d/)[1]
            }));
        }
        //console.log(this.piecesPositions);
        let pieceName = step.charAt(0),
            direction = step.charAt(1),
            walkSteps = parseInt(step.charAt(2)),
            oid = this.getObjectIdByName(pieceName, board),
            pp = null;

        for (let j=0; j<this.piecesPositions.length; j++) {
            if (pieceName == this.piecesPositions[j].name) {
                pp = this.piecesPositions[j];
                break;
            }
        }

        if (direction == '+')
            pp.position += (pp.type == 'h') ? walkSteps : 6 * walkSteps;
        else
            pp.position -= (pp.type == 'h') ? walkSteps : 6 * walkSteps;

        return {oid: oid, pos: pp.position};
    }
    
    setPieceNames(pieces, tpl) {
        if (tpl) {
            this.setPieceNameByTemplate(tpl);
            return tpl;
        }
        
        let template = '.'.repeat(36),
            piecePosition = [];
        
        pieces.forEach((piece, index) => {
            let x = parseInt(Math.round(parseFloat(piece.style.left)*6/100)),
                y = parseInt(Math.round(parseFloat(piece.style.top)*6/100)),
                hPos = x + 6 * y,
                vPos = 6 * x + y,
                isH = 'h' == piece.classList.value.match(/piece_(h|v)\d/)[1];
            piecePosition.push({index, hPos, vPos, isH});
        });
        piecePosition.sort((a,b) => a.hPos - b.hPos);
        //console.log(piecePosition);

        let pieceNumber = 2,  // start from "B"
            pId = 1;
        piecePosition.forEach(pp => {
            let position = pp.hPos,
                piece = pieces[pp.index],
                pieceName = '';

            if(piece.classList.contains('primary')) {
                pieceName = 'A';
            } else if(piece.classList.contains('frozen')) {
                pieceName = 'x';
            } else {
                pieceName = (pieceNumber++ + 9).toString(36).toUpperCase();
            }
            piece.dataset.name = pieceName;
            piece.dataset.position = position;

            if(pp.isH) {
                if(piece.classList.contains('primary')) {
                    piece.dataset.oid = 0;
                } else {
                    piece.dataset.oid = pId++;
                }
                piece.dataset.type = "h";
            } else {
                piece.dataset.type = "v";
            }

            template = this.setPieceName(template, piece, pieceName, position % 6, Math.floor(position/6));
        });

        piecePosition.sort((a,b) => a.vPos - b.vPos);
        piecePosition.forEach(pp => {
            let piece = pieces[pp.index];
            if(!pp.isH) {
                piece.dataset.oid = pId++;
            }
        });
        
        return template;
    }

    pieceAtPosition(piece, x, y) {
        let piece_x = parseFloat(piece.style.left),
            piece_y = parseFloat(piece.style.top);

        console.log(x, y, piece_x, piece_y);

        return (x === parseInt(Math.round(piece_x*6/100)) && y === parseInt(Math.round(piece_y*6/100)));
    }

    setPieceNameByTemplate(template) {
        let board = document.querySelector(".board__wrapper"),
            pieces = board.querySelectorAll('.piece:not(.frozen)'),
            visited = [];

        for(let i=0; i<pieces.length; i++) {
            let piece = pieces[i],
                piece_x = parseFloat(piece.style.left),
                piece_y = parseFloat(piece.style.top),
                position = parseInt(Math.round(piece_x*6/100)) + 6 * parseInt(Math.round(piece_y*6/100)),
                name = template.charAt(position);

            if (name.match(/[A-Z]/) && visited.indexOf(name) < 0) {
                visited.push(name);
                piece.dataset.name = name;
                piece.dataset.position = position;
                piece.dataset.oid = {
                    A: 0,
                    B: 1,
                    C: 2,
                    D: 3,
                    E: 4,
                    F: 5,
                    G: 6,
                    H: 7,
                    I: 8,
                    J: 9,
                    K: 10,
                    L: 11,
                    M: 12,
                    N: 13,
                    o: 14,
                    P: 15,
                    Q: 16,
                    R: 17,
                    S: 18,
                    T: 19,
                    U: 20,
                    V: 21,
                    W: 22,
                    x: 23,
                    Y: 24,
                    Z: 25,
                    O: 26
                }[name];
                piece.dataset.type = piece.classList.value.match(/piece_(h|v)\d/)[1];
                this.drawPieceName(piece, name);
            }
        }
    }

    setPieceName(template, piece, pieceName, x, y) {

        if (pieceName !== 'x') {
            this.drawPieceName(piece, pieceName);
        }

        let firstPosition = y*6 + x,
            repeatCount = 1,
            repeatAfter = 1;

        if (piece.classList.contains('primary') || piece.classList.contains('piece_h2') || piece.classList.contains('piece_v2')) {
            repeatCount = 2;
        } else if (piece.classList.contains('piece_h3') || piece.classList.contains('piece_v3')) {
            repeatCount = 3;
        }

        if (piece.classList.contains('piece_v2') || piece.classList.contains('piece_v3')) {
            repeatAfter = 6;
        }

        for(let i=0, pos=firstPosition; i<repeatCount; i++) {
            template = this.strReplace(template, pos, pieceName);
            pos = pos + repeatAfter;
        }
        
        return template;
    }

    drawPieceName(piece, name) {
        this.clearPiece(piece);
        
        let div = document.createElement('div');
        div.innerHTML = name;
        div.style.position = 'absolute';
        div.style.color = 'black';
        div.style.font = '20px monospace';
        div.style.background = 'white';
        div.style.borderRadius = '3px';
        div.style.padding = '4px 6px';
        div.style.opacity = '0.9';
        div.style.margin = '6px';
        piece.appendChild(div); 
    }

    clearPiece(piece) {
        while(piece.firstChild && piece.removeChild(piece.firstChild));
    }

    setSolution(solution) {
        this.solution = solution;
    }

    drawHelpBoard() {
        let gameContainer = document.querySelector('div.game-states .fs-grid'),
            container = gameContainer.querySelector('#solver_id');
        
        if (container) {
            while(container.firstChild && container.removeChild(container.firstChild));
        } else {
            container = document.createElement('div');
            container.id = 'solver_id';
            this.setContainerStyle(container);
            gameContainer.appendChild(container);
        }

        if (this.solution) {
            this.showSolution(container);
        }
    }

    showSolution (container) {
        let steps = this.solution;
        if (!steps) return;

        let solutionContainer = container.querySelector('#solution_container');
        if (solutionContainer) {
            while(solutionContainer.firstChild && solutionContainer.removeChild(solutionContainer.firstChild));
        } else {
            solutionContainer = document.createElement('div');
            solutionContainer.id = 'solution_container';
        }

        let stepsContainer = document.createElement('div');
        stepsContainer.id = 'solution_steps_container';
        for (let i=0; i<steps.length; i++) {
            let step = document.createElement('div');
            step.innerHTML = steps[i];
            this.setStepStyle(step);
            //console.log(step);
            let oidpos = this.getObjectIdAndNewPosition(steps[i], i);
            step.dataset.oid = oidpos.oid;
            step.dataset.pos = oidpos.pos;
            stepsContainer.appendChild(step);
        }

        solutionContainer.appendChild(stepsContainer);

        let controlsContainer = document.createElement('div'),
            controlsPlay = document.createElement('button'),
            controlsNext = document.createElement('button'),
            controlsAuto = document.createElement('button');

        controlsContainer.style.marginTop = '10px';
        controlsPlay.innerHTML = '&#9658; Показать шаг';
        controlsNext.innerHTML = '&#10097;&#10097; Следующий шаг';
        controlsAuto.innerHTML = '&#129302; Авто';
        this.setButtonProps(controlsPlay);
        this.setButtonProps(controlsNext);
        this.setButtonProps(controlsAuto);

        controlsPlay.addEventListener('click', () => this.playStep(stepsContainer));
        controlsNext.addEventListener('click', () => this.nextStep(stepsContainer));
        controlsAuto.addEventListener('click', () => this.autoPlay(stepsContainer));

        controlsContainer.appendChild(controlsPlay);
        controlsContainer.appendChild(controlsNext);
        controlsContainer.appendChild(controlsAuto);
        solutionContainer.appendChild(controlsContainer);
        container.appendChild(solutionContainer);
        setTimeout(() => controlsAuto.click(), 500);
    }

    autoPlay(stepsContainer) {
        let steps = [...stepsContainer.querySelectorAll('div')],
            active = stepsContainer.querySelectorAll('div.active'),
            index = -1;

        if (active) {
            index = active.length - 1;
            steps.splice(0, index+1);
        };

        if (steps.length < 1) return false;
        else location.reload();

        let step = steps[0],
            stepCode = step.innerHTML,
            pieceName = stepCode.charAt(0),
            direction = stepCode.charAt(1),
            walkSteps = stepCode.charAt(2);
        
        //console.log(pieceName, direction, walkSteps);

        let board = document.querySelector(".board__wrapper");
        if (board === null) return false;
        let piece = this.findPieceByName(pieceName, board);
        //console.log(piece);
        let objectId = parseInt(step.dataset.oid); //this.getObjectIdByName(pieceName, board);
        //console.log(pieceName, objectId);
        let position = parseInt(step.dataset.pos); //this.getPieceNewPosition(piece, direction, walkSteps);
        console.log(`Piece ${pieceName} move ${stepCode}, oid: ${objectId} pos: ${position}`);

        let result = httpClient(objectId, position);
        result.then(ok => {
            if (ok) {
                //console.log('Show step and play next');
                this.nextStep(stepsContainer, true);
                setTimeout(() => this.autoPlay(stepsContainer), 100);
            };
        });

    }

    playStep(stepsContainer, isReal = false) {
        let steps = stepsContainer.querySelectorAll('div.active'),
            active = null;

        if (!steps || steps.length < 1) {
            return false;
        }
        active = steps[steps.length - 1];
        let stepCode = active.innerHTML,
            pieceName = stepCode.charAt(0),
            direction = stepCode.charAt(1),
            walkSteps = stepCode.charAt(2);

        this.playStepOnBoard(pieceName, direction, walkSteps, isReal);
    }

    nextStep(stepsContainer, isReal = false) {
        let steps = stepsContainer.querySelectorAll('div'),
            active = stepsContainer.querySelectorAll('div.active'),
            index = -1;

        if (active) {
            index = active.length - 1;
        }

        if (steps[index] !== undefined && steps[index+1] !== undefined) {
            steps[index].style.background = 'lightblue';
            steps[index].style.color = 'grey';
            steps[index].style.borderColor = 'grey';
        }
        if (steps[index+1] !== undefined) {
            steps[index+1].classList.add('active');
            steps[index+1].style.background = 'lightgreen';
            steps[index+1].style.borderColor = 'black';
            this.playStep(stepsContainer, isReal);
        }
    }

    playStepOnBoard(pieceName, direction, walkSteps, isReal = false) {
        let board = document.querySelector(".board__wrapper");
        if (board === null) {
            return false;
        }
        
        let piece = this.findPieceByName(pieceName, board);
        if (!piece) {
            return false;
        }

        let pieceToMove = null;
        let existingPieces = [];
        if (!isReal) {
            pieceToMove = piece.cloneNode(true);
            pieceToMove.classList.add('piece_clon');
            existingPieces = this.findPieces(board);
            for (let i=0; i<existingPieces.length; i++) {
                existingPieces[i].style.opacity = '0.2';
            }
            pieceToMove.style.transition = "all 1s ease";
            board.appendChild(pieceToMove);
        } else {
            pieceToMove = piece;
            pieceToMove.style.transition = "all 0.25s ease";
        }
        
        let diffPosition = parseInt(walkSteps) * 100 / 6;

        setTimeout(() => {
            if (pieceToMove.classList.contains('piece_h2') || pieceToMove.classList.contains('piece_h3')) {
                let leftPosition = parseFloat(pieceToMove.style.left);
                if (direction === '+') {
                    pieceToMove.style.left = String(leftPosition + diffPosition) + '%';
                } else {
                    pieceToMove.style.left = String(leftPosition - diffPosition) + '%';
                }
            } else {
                let topPosition = parseFloat(pieceToMove.style.top);
                if (direction === '+') {
                    pieceToMove.style.top = String(topPosition + diffPosition) + '%';
                } else {
                    pieceToMove.style.top = String(topPosition - diffPosition) + '%';
                }
            }
        }, !isReal ? 1000 : 0);

        if (!isReal) {
            setTimeout(() => {
                board.removeChild(pieceToMove);
                for (let i=0; i<existingPieces.length; i++) {
                    existingPieces[i].style.opacity = '1.0';
                }
            }, 3000);
        }
    }

    setStepStyle(step) {
        let style = {
            display: 'inline-block',
            background: 'lightgrey',
            border: '1px solid grey',
            borderRadius: '3px',
            font: '16px monospace',
            color: 'black',
            padding: '2px 6px',
            margin: '2px',
        };
        Object.assign(step.style, style);
    }

    setContainerStyle(container) {
        let style = {
            width: '100%',
            background: 'darkgrey',
            border: '1px solid black',
            borderRadius: '6px',
            padding: '6px',
            textAlign: 'center',
            margin: '10px 150px 100px 0',
            zIndex: 2,
        };
        Object.assign(container.style, style);
    }

    setButtonProps(button) {
        let style = {
            background: 'linear-gradient(#f414d4, #a604aa)',
            boxShadow: '0 0 4px #f414d4',
            border: '1px solid darkmagenta',
            borderRadius: '4px',
            font: '12px Verdana',
            fontWeight: '600',
            color: 'white',
            padding: '4px 10px',
            margin: '5px',
        };
        Object.assign(button.style, style);
    }
}

function play() {
    let pageHelper = new PageHelper(),
        board = pageHelper.getBoard();

    if (!board) {
        location.reload();
        return;
    }

    let solver = new RHSolver(board),
        result = solver.solve();

    if (result) {
        pageHelper.setSolution(result.solution);
        pageHelper.drawHelpBoard();
    }
}

setTimeout(function() {
    let modal = document.querySelector('#modals-container');
    //console.log(modal);
    if (modal && modal.innerHTML !== '') {
        //console.log('modal');
        let objmap = modal.querySelector('.jungle-modal_objectsmap');
        if (objmap) {
            //console.log('objects map');
            let items = objmap.querySelectorAll('.map__items .map__item:not(.disabled,.finded)');
            if (items && items[0]) {
                items[0].click();
                setTimeout(() => {
                    modal.querySelector('.map__hint button').click();
                    let gift = modal.querySelector('.boostgift_bonus');
                    if (gift) gift.querySelector('button').click();
                    let prize = modal.querySelector('.jungle-modal_questprizes');
                    if (prize) {
                        prize.querySelector('.questprizes__footer button').click();
                    }
                    setTimeout(() => {play();}, 2000);
                }, 2000);
            }
        }
        let prize = modal.querySelector('.jungle-modal_questprizes');
        if (prize) {
            console.log('prize!');
            prize.querySelector('.questprizes__footer button').click();
            setTimeout(() => {play();}, 2000);
        }
        return true;
    }

    play();
}, 2000);

/*
(async () => {
    const params = {
        object_id: 0,
        position: 16,
        game_type: 0,
        _fs2ajax: 1,
    };
    const queryString = new URLSearchParams(params).toString();
    //console.log(queryString);
    
    const response = await fetch('/jungleStory2019/gameBoard/makeMove/', {
        method: 'POST',
        body: queryString,
        headers: {
            'Content-type': 'application/x-www-form-urlencoded',
        },
    })

    const data = await response;

    console.log(data)
})()
*/
