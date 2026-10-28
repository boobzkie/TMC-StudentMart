<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentFollowController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        /** @var User $viewer */
        $viewer = $request->user();

        return response()->json([
            'success' => true,
            'followers_count' => $this->activeStudentRelation($viewer->followers())->count(),
            'following_count' => $this->activeStudentRelation($viewer->following())->count(),
        ]);
    }

    public function status(Request $request, User $student): JsonResponse
    {
        $this->ensureActiveStudent($student);
        /** @var User $viewer */
        $viewer = $request->user();

        return response()->json([
            'success' => true,
            'student' => $this->publicStudent($student),
            'followers_count' => $this->activeStudentRelation($student->followers())->count(),
            'following_count' => $this->activeStudentRelation($student->following())->count(),
            'is_following' => $viewer->following()->whereKey($student->getKey())->exists(),
            'is_self' => $viewer->is($student),
        ]);
    }

    public function follow(Request $request, User $student): JsonResponse
    {
        $this->ensureActiveStudent($student);
        /** @var User $viewer */
        $viewer = $request->user();

        if ($viewer->is($student)) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot follow your own account.',
            ], 422);
        }

        DB::table('student_follows')->insertOrIgnore([
            'follower_id' => $viewer->getKey(),
            'following_id' => $student->getKey(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $this->status($request, $student);
    }

    public function unfollow(Request $request, User $student): JsonResponse
    {
        $this->ensureActiveStudent($student);
        /** @var User $viewer */
        $viewer = $request->user();

        if ($viewer->is($student)) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot unfollow your own account.',
            ], 422);
        }

        $viewer->following()->detach($student->getKey());

        return $this->status($request, $student);
    }

    public function followers(Request $request): JsonResponse
    {
        /** @var User $viewer */
        $viewer = $request->user();

        return $this->connectionList($viewer, $viewer->followers());
    }

    public function following(Request $request): JsonResponse
    {
        /** @var User $viewer */
        $viewer = $request->user();

        return $this->connectionList($viewer, $viewer->following());
    }

    public function studentFollowers(Request $request, User $student): JsonResponse
    {
        $this->ensureActiveStudent($student);

        return $this->connectionList($request->user(), $student->followers());
    }

    public function studentFollowing(Request $request, User $student): JsonResponse
    {
        $this->ensureActiveStudent($student);

        return $this->connectionList($request->user(), $student->following());
    }

    private function connectionList(User $viewer, BelongsToMany $relation): JsonResponse
    {
        $page = $this->activeStudentRelation($relation)
            ->orderByPivot('created_at', 'desc')
            ->paginate(30, [
                'users.id',
                'users.name',
                'users.course',
                'users.profile_picture',
            ]);

        $ids = $page->getCollection()->modelKeys();
        $followingIds = $ids === []
            ? []
            : $viewer->following()->whereIn('users.id', $ids)->pluck('users.id')->all();

        return response()->json([
            'success' => true,
            'accounts' => $page->getCollection()->map(fn (User $student): array => [
                ...$this->publicStudent($student),
                'is_following' => in_array($student->getKey(), $followingIds),
            ])->values(),
            'total' => $page->total(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
        ]);
    }

    private function activeStudentRelation(BelongsToMany $relation): BelongsToMany
    {
        return $relation
            ->where('users.role', 'student')
            ->where('users.status', 'active');
    }

    private function ensureActiveStudent(User $student): void
    {
        abort_unless($student->isStudent() && $student->isActive(), 404);
    }

    /** @return array{id: int, name: string, username: string, bio: ?string, course: ?string, profile_picture: ?string} */
    private function publicStudent(User $student): array
    {
        return [
            'id' => (int) $student->getKey(),
            'name' => (string) $student->name,
            'username' => $student->username ?: 'student'.$student->getKey(),
            'bio' => $student->bio,
            'course' => $student->course,
            'profile_picture' => $student->profile_picture,
        ];
    }
}
