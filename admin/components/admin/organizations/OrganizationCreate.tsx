import {
  Create,
  SimpleForm,
  TextInput,
  SelectInput,
  required,
  email,
} from 'react-admin';

const currencies = ['USD', 'EUR', 'GBP', 'JPY'];
const valuationMethods = ['FIFO', 'LIFO', 'WAC'];

export const OrganizationCreate = () => (
  <Create redirect="list">
    <SimpleForm>
      <TextInput
        source="org_name"
        label="Organization Name"
        validate={[required()]}
        fullWidth
      />
      
      <SelectInput
        source="currency"
        label="Currency"
        choices={currencies.map(c => ({ id: c, name: c }))}
        validate={[required()]}
      />
      
      <SelectInput
        source="valuation_method"
        label="Valuation Method"
        choices={valuationMethods.map(m => ({ id: m, name: m }))}
        validate={[required()]}
      />
      
      <TextInput
        source="admin_email"
        label="Admin Email"
        type="email"
        validate={[required(), email()]}
        fullWidth
      />
      
      <TextInput
        source="admin_first_name"
        label="Admin First Name"
        validate={[required()]}
      />
      
      <TextInput
        source="admin_last_name"
        label="Admin Last Name"
        validate={[required()]}
      />
    </SimpleForm>
  </Create>
);
