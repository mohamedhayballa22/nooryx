import { DataProvider, GetListParams, GetListResult, GetOneParams, GetOneResult, GetManyParams, GetManyResult, GetManyReferenceParams, GetManyReferenceResult, CreateParams, CreateResult, UpdateParams, UpdateResult, UpdateManyParams, UpdateManyResult, DeleteParams, DeleteResult, DeleteManyParams, DeleteManyResult, RaRecord } from 'react-admin';
import { adminApiClient } from './adminClient';

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Helper function to transform organization records
const transformOrganization = (org: any) => ({
  ...org,
  id: org.org_id,
});

const transformWaitlistEntry = (entry: any, index: number) => ({
  ...entry,
  id: entry.email, // Use email as unique identifier
});

export const dataProvider: DataProvider = {
  getList: async <RecordType extends RaRecord = RaRecord>(
    resource: string,
    params: GetListParams
  ): Promise<GetListResult<RecordType>> => {
    const { page = 1, perPage = 25 } = params.pagination || {};

    const queryParams = new URLSearchParams({
      page: String(page),
      size: String(perPage),
    });

    const response = await adminApiClient<PaginatedResponse<any>>(
      `/admin/${resource}?${queryParams.toString()}`
    );

    // Transform data based on resource type
    let data;
    if (resource === 'organizations') {
      data = response.items.map(transformOrganization);
    } else if (resource === 'waitlist') {
      data = response.items.map(transformWaitlistEntry);
    } else {
      data = response.items;
    }

    return {
      data: data as RecordType[],
      total: response.total,
    };
  },

  getOne: async <RecordType extends RaRecord = RaRecord>(
    resource: string,
    params: GetOneParams
  ): Promise<GetOneResult<RecordType>> => {
    const data = await adminApiClient<any>(`/admin/${resource}/${params.id}`);
    
    // Transform data based on resource type
    let transformedData;
    if (resource === 'organizations') {
      transformedData = transformOrganization(data);
    } else if (resource === 'waitlist') {
      transformedData = transformWaitlistEntry(data, 0);
    } else {
      transformedData = data;
    }
    
    return { data: transformedData as RecordType };
  },

  getMany: async <RecordType extends RaRecord = RaRecord>(
    resource: string,
    params: GetManyParams
  ): Promise<GetManyResult<RecordType>> => {
    // Read-only admin - not implemented
    throw new Error('getMany not supported in admin panel');
  },

  getManyReference: async <RecordType extends RaRecord = RaRecord>(
    resource: string,
    params: GetManyReferenceParams
  ): Promise<GetManyReferenceResult<RecordType>> => {
    // Read-only admin - not implemented
    throw new Error('getManyReference not supported in admin panel');
  },

  create: async <RecordType extends RaRecord = RaRecord>(
    resource: string,
    params: CreateParams
  ): Promise<CreateResult<RecordType>> => {
    // Read-only admin - not implemented
    throw new Error('Create not supported in read-only admin panel');
  },

  update: async <RecordType extends RaRecord = RaRecord>(
    resource: string,
    params: UpdateParams
  ): Promise<UpdateResult<RecordType>> => {
    // Read-only admin - not implemented
    throw new Error('Update not supported in read-only admin panel');
  },

  updateMany: async (
    resource: string,
    params: UpdateManyParams
  ): Promise<UpdateManyResult> => {
    // Read-only admin - not implemented
    throw new Error('UpdateMany not supported in read-only admin panel');
  },

  delete: async <RecordType extends RaRecord = RaRecord>(
    resource: string,
    params: DeleteParams
  ): Promise<DeleteResult<RecordType>> => {
    // Read-only admin - not implemented
    throw new Error('Delete not supported in read-only admin panel');
  },

  deleteMany: async (
    resource: string,
    params: DeleteManyParams
  ): Promise<DeleteManyResult> => {
    // Read-only admin - not implemented
    throw new Error('DeleteMany not supported in read-only admin panel');
  },
};
