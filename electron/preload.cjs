const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('sanad', {
  settings: {
    get: () => call('settings:get'),
    save: (values) => call('settings:save', values),
    pickLogo: () => call('settings:pickLogo'),
  },
  printers: { list: () => call('printers:list') },
  backup: { create: () => call('backup:create') },
  books: {
    list: () => call('books:list'),
    create: (data) => call('books:create', data),
    setStatus: (id, status) => call('books:setStatus', id, status),
    next: (id) => call('books:next', id),
  },
  customers: { search: (q) => call('customers:search', q) },
  vouchers: {
    list: (filters) => call('vouchers:list', filters),
    get: (id) => call('vouchers:get', id),
    create: (bookId, data) => call('vouchers:create', bookId, data),
    update: (id, data) => call('vouchers:update', id, data),
    cancel: (id, reason) => call('vouchers:cancel', id, reason),
    print: (id, mode) => call('vouchers:print', id, mode),
  },
  printReady: () => ipcRenderer.send('print:ready'),
});
