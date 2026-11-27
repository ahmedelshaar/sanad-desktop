const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('sanad', {
  settings: {
    get: () => call('settings:get'),
    save: (values) => call('settings:save', values),
    pickLogo: () => call('settings:pickLogo'),
  },
  app: { info: () => call('app:info'), openSite: () => call('app:openSite') },
  license: {
    status: () => call('license:status'),
    register: (data) => call('license:register', data),
    check: () => call('license:check'),
  },
  onLicenseChanged: (fn) => {
    const listener = (_e, state) => fn(state);
    ipcRenderer.on('license:changed', listener);
    return () => ipcRenderer.removeListener('license:changed', listener);
  },
  printers: { list: () => call('printers:list') },
  backup: { create: () => call('backup:create'), restore: () => call('backup:restore') },
  books: {
    list: () => call('books:list'),
    create: (data) => call('books:create', data),
    setStatus: (id, status) => call('books:setStatus', id, status),
    next: (id) => call('books:next', id),
    print: (id, mode) => call('books:print', id, mode),
    createInstallments: (data) => call('books:createInstallments', data),
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
