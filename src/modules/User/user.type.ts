
export interface UserRow {
    id: number;
    email: string;
    name: string;
    phone: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateUserDTO {
    name: string;
    email: string;
    phone?: string;
}