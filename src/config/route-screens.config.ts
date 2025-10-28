export const routeScreenMap = {
  userManagement: {
    createUser: "/createUser",
    updateUser: "/update/:user_id",
    updateUserStatus: "/updateUserStatus/:user_id",
    deleteUser: "/delete/:user_id",
    userDetails: "/userDetails/:userId",
    columnPreferences: "/userColumnPreferences",
    getColumnPreference: "/getUserColumnPreference/:user_id/:table_name",
    tenusers: "/tenUsers",
    customerUsersByAssignedAccounts: "/customerUsersByAssignedAccounts/:userId",
  },
  customers: {
    customerDetailsAndAccounts: "/userCustomerDetailsAndAccounts/:userId",
  },

  downloads: {
    allUsers: "/downloadAllTenUsers",
    customerUsers: "/downloadCustomerUsersByAccountAssignment/:userId",
    customers: "/downloadCustomers",
    tenUsers: "/downloadAllTenUsers",
  },

  accounts: {
    userRelatedAccounts: "/userCustomerDetailsAndAccounts/:userId",
  },

  tenUser: {
    customers: "/customers",
    usersByCustomer: "/usersByCustomerId",
    customerAccounts: "/customerAccounts/:customerId",
    customerUsers: "/customerUsers",
    downloadCustomerAccounts: "/downloadCustomerAccounts/:customerId",
  },
};
