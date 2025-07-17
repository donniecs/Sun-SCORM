/**
 * Mock Database for Development/Testing
 * Provides basic CRUD operations for testing the API without database connectivity
 */

export interface MockUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  tenantId: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockTenant {
  id: string;
  name: string;
  domain: string;
  settings: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockCourse {
  id: string;
  title: string;
  version: string;
  fileCount: number;
  structure: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockDispatch {
  id: string;
  courseId: string;
  tenantId: string;
  mode: string;
  maxUsers: number | null;
  expiresAt: Date | null;
  allowAnalytics: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage
const mockUsers: MockUser[] = [
  {
    id: '1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    password: '$2b$12$sJlOzvvJvBBxmtV1dzldS.OJ8F6AI4x7dWgyD4Kk2I7mAUdmM.c6W', // adminpass123
    tenantId: '1',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const mockTenants: MockTenant[] = [
  {
    id: '1',
    name: 'Test Organization',
    domain: 'test.example.com',
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const mockCourses: MockCourse[] = [
  {
    id: '1',
    title: 'Sample SCORM Course',
    version: '1.0',
    fileCount: 5,
    structure: JSON.stringify(['index.html', 'style.css', 'script.js']),
    ownerId: '1',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const mockDispatches: MockDispatch[] = [];

// Mock Prisma client interface
export const mockPrisma = {
  user: {
    findUnique: async ({ where, include }: { where: any; include?: any }) => {
      let user: MockUser | undefined;
      if (where.email) {
        user = mockUsers.find(u => u.email === where.email);
      } else if (where.id) {
        user = mockUsers.find(u => u.id === where.id);
      }
      
      if (!user) return null;
      
      // Add tenant if included
      const result: any = { ...user };
      if (include?.tenant) {
        result.tenant = mockTenants.find(t => t.id === user.tenantId);
      }
      
      return result;
    },
    create: async ({ data }: { data: any }) => {
      const newUser: MockUser = {
        id: String(mockUsers.length + 1),
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        tenantId: data.tenantId,
        role: data.role || 'learner',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockUsers.push(newUser);
      return newUser;
    },
    findMany: async () => mockUsers
  },
  tenant: {
    create: async ({ data }: { data: any }) => {
      const newTenant: MockTenant = {
        id: String(mockTenants.length + 1),
        name: data.name,
        domain: data.domain || `${data.name.toLowerCase()}.example.com`,
        settings: data.settings || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockTenants.push(newTenant);
      return newTenant;
    },
    findMany: async () => mockTenants,
    findUnique: async ({ where }: { where: any }) => {
      return mockTenants.find(t => t.id === where.id) || null;
    }
  },
  course: {
    create: async ({ data }: { data: any }) => {
      const newCourse: MockCourse = {
        id: String(mockCourses.length + 1),
        title: data.title,
        version: data.version,
        fileCount: data.fileCount,
        structure: data.structure,
        ownerId: data.ownerId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockCourses.push(newCourse);
      return newCourse;
    },
    findMany: async ({ where }: { where?: any } = {}) => {
      if (where?.ownerId) {
        return mockCourses.filter(c => c.ownerId === where.ownerId);
      }
      return mockCourses;
    },
    findUnique: async ({ where }: { where: any }) => {
      return mockCourses.find(c => c.id === where.id) || null;
    }
  },
  dispatch: {
    create: async ({ data }: { data: any }) => {
      const newDispatch: MockDispatch = {
        id: String(mockDispatches.length + 1),
        courseId: data.courseId,
        tenantId: data.tenantId,
        mode: data.mode,
        maxUsers: data.maxUsers,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        allowAnalytics: data.allowAnalytics,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockDispatches.push(newDispatch);
      return newDispatch;
    },
    findMany: async ({ include }: { include?: any } = {}) => {
      return mockDispatches.map(d => ({
        ...d,
        course: include?.course ? mockCourses.find(c => c.id === d.courseId) : undefined,
        tenant: include?.tenant ? mockTenants.find(t => t.id === d.tenantId) : undefined,
        users: include?.users ? [] : undefined
      }));
    },
    findUnique: async ({ where, include }: { where: any; include?: any }) => {
      const dispatch = mockDispatches.find(d => d.id === where.id);
      if (!dispatch) return null;
      
      return {
        ...dispatch,
        course: include?.course ? mockCourses.find(c => c.id === dispatch.courseId) : undefined,
        tenant: include?.tenant ? mockTenants.find(t => t.id === dispatch.tenantId) : undefined,
        users: include?.users ? [] : undefined
      };
    },
    delete: async ({ where }: { where: any }) => {
      const index = mockDispatches.findIndex(d => d.id === where.id);
      if (index > -1) {
        return mockDispatches.splice(index, 1)[0];
      }
      return null;
    }
  },
  $transaction: async (callback: any) => {
    return callback(mockPrisma);
  }
};

export default mockPrisma;