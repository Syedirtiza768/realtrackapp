export declare class LoginDto {
    email: string;
    password: string;
    vertical?: 'automotive' | 'fashion' | 'business_industrial';
}
export declare class RegisterDto {
    email: string;
    password: string;
    name?: string;
}
export declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
