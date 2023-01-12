const searchInput = document.getElementById('searchInput');

const suggests = document.querySelector('.suggests');

suggests.style.display = 'none';

const searchHistoryList = document.querySelector('.search-history__list');
const searchHistoryMessage = document.querySelector('.search-history__message');
searchHistoryList.style.display = 'none';
searchHistoryMessage.style.display = 'none';

const storageLoadedDataField = 'loadedData';
const storageHistoryQueueField = 'historyQueue';

const MAX_SUGGEST_NUMBER = 10;
const MAX_STORED_SUGGEST_NUMBER = 5;
const MAX_SEARCH_HISTORY_ITEMS_NUMBER = 3;

const errorMessage = document.querySelector('.error-message');

const TIMEOUT_INTERVAL = 100;

renderSearchHistory(localStorage.getItem(storageHistoryQueueField));
window.addEventListener('focus', () => renderSearchHistory(localStorage.getItem(storageHistoryQueueField)));

const resultContainer = document.querySelector('.main-container__result');
resultContainer.style.display = 'none';

searchInput.addEventListener('focus', inputHandler);
searchInput.addEventListener('input', inputHandler);

document.addEventListener('click', (event) => {
    if (event.target !== searchInput) {
        suggests.style.display = 'none';
    }
});

searchInput.setAttribute('tabindex', 0);

searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        suggests.style.display = 'none';
        searchInput.value = '';
    }
});

const api = new SearchAPI();

function SearchAPI() {
    const buildUrl = (keyword) => {
        return `https://api.smk.dk/api/v1/art/search?keys=${keyword}%2A&qfields=titles&qfields=creator&qfields=tags&qfields=content_subject&facets=has_image&filters=%5Bhas_image%3Atrue%5D&offset=0&rows=${MAX_SUGGEST_NUMBER}&lang=en`;
    };

    const loadData = async (keyword) => {
        const response = await fetch(buildUrl(keyword), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            redirect: 'follow',
        });
        if (!response.ok) {
            const message = `${response.status}`;
            throw new Error(message);
        }
        return response.json();
    };

    this.getDataByKeyword = async (keyword) => {
        const data = await loadData(keyword);
        const result = data.items.map((item) => {
            return {
                id: item.object_number,
                creators: item.production
                    ? item.production.map((creator) => {
                          return {
                              name: creator.creator_forename,
                              surname: creator.creator_surname,
                              birthDate: creator.creator_date_of_birth,
                              deathDate: creator.creator_date_of_death,
                          };
                      })
                    : null,
                year: item.production_date ? item.production_date[0].period : null,
                title: item.titles[0].title,
                imgUrl: item.image_thumbnail,
                note: item.production ? item.production[0].creator_history : null,
            };
        });

        return result;
    };
}

let timer = null;
let keyword;
let currentLocalSuggestLength = 0;

function renderLocalSuggests() {
    keyword = searchInput.value.trim();
    suggests.innerHTML = '';
    suggests.style.display = 'block';
    const localSuggestArray = buildLocalSuggestArray(keyword);
    currentLocalSuggestLength = localSuggestArray.length;
    if (localSuggestArray.length > 0) {
        suggests.appendChild(buildUlByDataArray(localSuggestArray, true));
    }
}

function inputHandler() {
    renderLocalSuggests();
    if (!keyword) {
        return;
    }
    // Throttling
    if (timer) {
        clearTimeout(timer);
    }

    timer = setTimeout(() => {
        buildApiSuggestArray(keyword)
            .then((result) => {
                if (result.dataArray.length === 0 || result.keyword !== keyword) {
                    if (currentLocalSuggestLength === 0) {
                        renderNoRecMessage();
                    }
                } else {
                    renderLocalSuggests();
                    suggests.appendChild(
                        buildUlByDataArray(
                            result.dataArray.slice(0, MAX_SUGGEST_NUMBER - currentLocalSuggestLength),
                            false
                        )
                    );
                }
            })
            .catch((error) => renderErrorMessage(error));
    }, TIMEOUT_INTERVAL);
}

function buildLocalSuggestArray(keyword) {
    return getMatchingLocalData(keyword).slice(0, MAX_STORED_SUGGEST_NUMBER);
}

async function buildApiSuggestArray(keyword) {
    const dataArray = await api.getDataByKeyword(keyword);
    return { dataArray, keyword };
}

function buildUlByDataArray(dataArray, isLocal) {
    const ul = document.createElement('ul');
    ul.classList.add('suggest-list');
    if (isLocal) {
        ul.classList.add('suggest-list-stored');
    } else {
        ul.classList.add('suggest-list-rec');
    }
    dataArray.forEach((dataItem) => {
        const suggestListItem = buildSuggestItem(dataItem);
        if (isLocal) {
            suggestListItem.classList.add('suggest-list__item-stored');
        }
        suggestListItem.addEventListener('click', () => {
            if (!isLocal) {
                updateStoredData(dataItem);
            }
            updateHistoryQueue(dataItem);
            renderResult(dataItem);
        });
        ul.appendChild(suggestListItem);
    });
    return ul;
}

function updateStoredData(data) {
    let localData = JSON.parse(localStorage.getItem(storageLoadedDataField));
    localData = localData ? localData.concat(data) : [data];
    localStorage.setItem(storageLoadedDataField, JSON.stringify(localData));
}

// /////////////////////

function buildSuggestItem(dataItem) {
    const titleStr = dataItem.title;
    let creatorStr = '';
    if (dataItem.creators) {
        creatorStr = dataItem.creators.map((creator) => [creator.name, creator.surname].join(' ').trim()).join(', ');
    }

    const suggestListItem = document.createElement('li');
    suggestListItem.classList.add('suggest-list__item');
    const suggestListTitle = document.createElement('div');
    suggestListTitle.innerHTML = titleStr;
    suggestListTitle.classList.add('suggest-list__title');
    suggestListItem.appendChild(suggestListTitle);

    if (creatorStr !== '') {
        const suggestListCreator = document.createElement('div');
        suggestListCreator.classList.add('suggest-list__creator');

        suggestListCreator.innerHTML = creatorStr;
        suggestListItem.appendChild(suggestListCreator);
    }

    return suggestListItem;
}

function renderResult(data) {
    searchInput.value = '';
    renderSearchHistory();
    resultContainer.style.display = 'block';
    const img = document.querySelector('.art__image');
    const title = document.querySelector('.art__title');
    const creatorList = document.querySelector('.art__creators');
    const productionYear = document.querySelector('.art__production-year');
    const note = document.querySelector('.art__note');

    creatorList.innerHTML = '';

    title.textContent = data.title;

    data.year && (productionYear.textContent = `Created: ${data.year}`);

    img.src = data.imgUrl;
    img.alt = data.title;
    data.creators.forEach((creator) => {
        const birthDate = creator.birthDate ? new Date(creator.birthDate).getFullYear() : null;
        const deathDate = creator.deathDate ? new Date(creator.deathDate).getFullYear() : null;
        let lifePeriod;
        if (!birthDate && !deathDate) {
            lifePeriod = 'n/a';
        } else {
            if (!birthDate) {
                lifePeriod = `dd. ${deathDate}`;
            }
            if (!deathDate) {
                lifePeriod = `br. ${birthDate}`;
            } else {
                lifePeriod = [birthDate, deathDate].join(' \u2013  ');
            }
        }
        const name = [creator.name, creator.surname].join(' ');
        const creatorListItem = document.createElement('li');
        creatorListItem.classList.add('.art__creator');
        creatorListItem.textContent = `${name} (${lifePeriod})`;
        creatorList.append(creatorListItem);
    });

    if (data.note) {
        note.style.display = 'block';
        note.textContent = data.note;
    } else {
        note.style.display = 'none';
    }
}

function getMatchingLocalData(str) {
    str = str.replaceAll(/\s/g, '').toLowerCase();
    const dataStored = JSON.parse(localStorage.getItem(storageLoadedDataField));
    if (!dataStored) {
        return [];
    }
    if (str === '') {
        return dataStored;
    }
    dataStored.forEach((data) => {
        const creatorStr = data.creators.reduce((res, creator) => {
            return res + creator.name + creator.surname;
        }, '');
        data.checkStr = (data.title + creatorStr).replaceAll(/\s/g, '').toLowerCase();
    });
    return dataStored.filter((data) => data.checkStr.includes(str));
}

function renderSearchHistory() {
    searchHistoryList.innerHTML = '';
    const dataStoredArray = JSON.parse(localStorage.getItem(storageLoadedDataField));
    const queue = JSON.parse(localStorage.getItem(storageHistoryQueueField));
    if (!queue || !dataStoredArray) {
        searchHistoryMessage.style.display = 'block';
        return;
    }

    searchHistoryMessage.style.display = 'none';
    searchHistoryList.style.display = 'block';

    const searchHistoryData = queue.map((id) => dataStoredArray.find((data) => data.id === id)).reverse();

    searchHistoryData.forEach((data) => {
        const searchHistoryItem = document.createElement('li');
        searchHistoryItem.textContent = data.title;
        searchHistoryItem.classList.add('search-history__item');

        searchHistoryItem.addEventListener('click', () => {
            renderResult(data);
        });
        searchHistoryList.appendChild(searchHistoryItem);
    });
}

function updateHistoryQueue(data) {
    let queue = JSON.parse(localStorage.getItem(storageHistoryQueueField));
    if (!queue) {
        queue = [];
    }
    queue.push(data.id);
    if (queue.length > MAX_SEARCH_HISTORY_ITEMS_NUMBER) {
        queue.shift();
    }
    localStorage.setItem(storageHistoryQueueField, JSON.stringify(queue));
    return queue;
}

function renderNoRecMessage() {
    suggests.innerHTML = '';
    const message = document.createElement('div');
    message.classList.add('norec-message');
    message.textContent = 'No recommendations...';
    suggests.appendChild(message);
}

function renderErrorMessage(error) {
    errorMessage.textContent = `Something went wrong! ${error}. Try to reload page.`;
    errorMessage.style.display = 'block';
}
