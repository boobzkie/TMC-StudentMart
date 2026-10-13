<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class RegistrationController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | REGISTER STUDENT
    |--------------------------------------------------------------------------
    */

    public function register(Request $request)
    {
        /*
        |--------------------------------------------------------------------------
        | VALIDATION
        |--------------------------------------------------------------------------
        */

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
            ],

            'student_id' => [
                'required',
                'string',
                'max:50',
                'unique:users,student_id',
            ],

            'email' => [
                'required',
                'email',
                'max:255',
                'unique:users,email',
            ],

            'contact_number' => [
                'required',
                'string',
                'max:30',
            ],

            'password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
            ],

            'profile_picture' => [
                'nullable',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:2048',
            ],
        ]);

        /*
        |--------------------------------------------------------------------------
        | PROFILE PICTURE
        |--------------------------------------------------------------------------
        */

        $profilePicture = null;

        if ($request->hasFile('profile_picture')) {

            $profilePicture = $request
                ->file('profile_picture')
                ->store('profile-pictures', 'public');
        }

        /*
        |--------------------------------------------------------------------------
        | CREATE STUDENT
        |--------------------------------------------------------------------------
        |
        | IMPORTANT:
        |
        | The role is NEVER accepted from the frontend.
        |
        | Every public registration becomes a student.
        |
        */

        $user = User::create([
            'name' => $validated['name'],

            'student_id' => $validated['student_id'],

            'email' => $validated['email'],

            'contact_number' => $validated['contact_number'],

            'password' => $validated['password'],

            'profile_picture' => $profilePicture,

            'role' => 'student',

            'status' => 'active',
        ]);

        /*
        |--------------------------------------------------------------------------
        | RESPONSE
        |--------------------------------------------------------------------------
        */

        return response()->json([
            'message' => 'Registration successful!',

            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'student_id' => $user->student_id,
                'email' => $user->email,
                'contact_number' => $user->contact_number,
                'profile_picture' => $user->profile_picture,
                'role' => $user->role,
                'status' => $user->status,
            ],
        ], 201);
    }
}
