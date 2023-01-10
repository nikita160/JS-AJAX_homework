const searchInput = document.getElementById('searchInput');

const suggests = document.querySelector('.suggests');

suggests.style.display = 'none';

const suggestListStored = document.querySelector('.suggest-list-stored');
const suggestListRec = document.querySelector('.suggest-list-rec');
const suggestHeaderStored = document.querySelector('.suggest__header-stored');
const suggestHeaderRec = document.querySelector('.suggest__header-rec');
const suggestHeaderNoRec = document.querySelector('.suggest__header-norec');

const searchHistoryList = document.querySelector('.search-history__list');
const searchHistoryMessage = document.querySelector('.search-history__message');
searchHistoryList.style.display = 'none';
searchHistoryMessage.style.display = 'none';

const storageLoadedDataField = 'loadedData';
const storageHistoryQueueField = 'historyQueue';

const maxApiSuggestNumber = 10;
const maxStoredSuggestNumber = 5;
const maxSearchHistoryItemsNumber = 3;

const errorMessage = document.querySelector('.error-message');

renderSearchHistory(localStorage.getItem(storageHistoryQueueField));
window.addEventListener('focus', () => renderSearchHistory(localStorage.getItem(storageHistoryQueueField)));

const resultContainer = document.querySelector('.main-container__result');
resultContainer.style.display = 'none';

searchInput.addEventListener('input', renderSuggestList);
searchInput.addEventListener('focus', renderSuggestList);

document.addEventListener('click', (e) => {
    if (e.target !== searchInput) {
        suggests.style.display = 'none';
    }
});

const api = new SearchAPI();

function SearchAPI() {
    let dataCache = [];

    const buildUrl = (keyword) => {
        return `https://api.smk.dk/api/v1/art/search?keys=${keyword}%2A&qfields=titles&qfields=creator&qfields=tags&qfields=content_subject&facets=has_image&filters=%5Bhas_image%3Atrue%5D&offset=0&rows=${
            maxApiSuggestNumber + maxStoredSuggestNumber
        }&lang=en`;
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
        dataCache = [];
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
        dataCache = [...result];
        return result;
    };

    this.getDataById = (id) => {
        return dataCache.find((data) => data.id === id);
    };
}

async function renderSuggestList() {
    suggestListStored.innerHTML = '';
    suggestListRec.innerHTML = '';

    suggestHeaderStored.style.display = 'none';
    suggestHeaderRec.style.display = 'none';
    suggestHeaderNoRec.style.display = 'none';
    suggests.style.display = 'none';

    const keyword = searchInput.value.trim();

    const dataStored = getMatchingLocalData(keyword);

    searchInput.removeEventListener('input', renderSuggestList);
    searchInput.removeEventListener('focus', renderSuggestList);
    let dataLoaded;
    try {
        dataLoaded = await api.getDataByKeyword(keyword);
    } catch (error) {
        renderErrorMessage(error);
    }
    searchInput.addEventListener('input', renderSuggestList);
    searchInput.addEventListener('focus', renderSuggestList);

    dataStored.length > 0 && (suggestHeaderStored.style.display = 'block');
    dataStored.length > 0 && (suggests.style.display = 'block');

    dataStored.forEach((dataItem) => {
        const suggestListItem = buildSuggestItem(dataItem);
        suggestListItem.classList.add('suggest-list__item-stored');
        suggestListStored.appendChild(suggestListItem);
        suggestListItem.addEventListener('click', () => {
            updateHistoryQueue(dataItem);
            renderResult(dataItem);
        });
    });

    if (!keyword) {
        return;
    }

    dataLoaded = dataLoaded.filter((data) => !dataStored.find((d) => d.id === data.id));

    dataLoaded.length > 0 && (suggestHeaderRec.style.display = 'block');
    dataLoaded.length === 0 && (suggestHeaderNoRec.style.display = 'block');

    suggests.style.display = 'block';

    dataLoaded.forEach((dataItem) => {
        const suggestListItem = buildSuggestItem(dataItem);
        suggestListRec.appendChild(suggestListItem);
        suggestListItem.addEventListener('click', () => {
            let localData = JSON.parse(localStorage.getItem(storageLoadedDataField));
            if (localData) {
                localData.push(dataItem);
            } else {
                localData = [dataItem];
            }
            localStorage.setItem(storageLoadedDataField, JSON.stringify(localData));
            updateHistoryQueue(dataItem);
            renderResult(dataItem);
        });
    });
}

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
        return dataStored.splice(0, maxStoredSuggestNumber);
    }
    dataStored.forEach((data) => {
        const creatorStr = data.creators.reduce((res, creator) => {
            return res + creator.name + creator.surname;
        }, '');
        data.checkStr = (data.title + creatorStr).replaceAll(/\s/g, '').toLowerCase();
    });
    return dataStored.filter((data) => data.checkStr.includes(str)).splice(0, maxStoredSuggestNumber);
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

    // console.log(searchHistoryData);
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
    if (queue.length > maxSearchHistoryItemsNumber) {
        queue.shift();
    }
    localStorage.setItem(storageHistoryQueueField, JSON.stringify(queue));
    return queue;
}

function renderErrorMessage(error) {
    errorMessage.textContent = `Something went wrong! ${error}. Try to reload page.`;
    errorMessage.style.display = 'block';
}
